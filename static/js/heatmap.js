(function () {
  'use strict';
  /*globals window, d3 */

  function extend(out) {
    var i, key;
    out = out || {};

    for (i = 1; i < arguments.length; i+=1) {
      if (!arguments[i]) {
        continue;
      }

      for (key in arguments[i]) {
        if (arguments[i].hasOwnProperty(key)) {
          out[key] = arguments[i][key];
        }
      }
    }

    return out;
  }

  function accessor(initial, callback) {
    return (function() {
      var value = initial;
      return function(x) {
        if (!arguments.length) {
          return value;
        }
        if (callback) {
          callback(value, x);
        }
        value = x;
        return this;
      };
    }());
  }

  var generateComponent = function(plot, defaults, options) {

    var attrs = [],
        standard = { click: Object };

    defaults = extend({}, standard, defaults);

    this.attr = function(key, value) {
      attrs.push({key: key, value: value});
      return this;
    };

    this.draw = function(raw) {
      var data = this.preprocess(raw),
          selection = this.render(data);

      attrs.forEach(function(attr) {
        selection.attr(attr.key, attr.value);
      });
      return this;
    };

    this.cellSize = function() { return this._plot.cellSize(); };

    this.ordered = function() {
      return this._plot.ordered.apply(this._plot, arguments);
    };

    var self = this,
        config = extend({}, defaults, options);

    Object.keys(defaults).forEach(function(key) {
      self[key] = accessor(config[key]);
    });

    this._plot = plot;

    return this;
  };

  var generateCell = function(plot, options) {
    
    this.idiFill = function() {
      var isoInterp = d3.interpolateRgb("#B10026", "#E31A1C"),
          nearInterp = d3.interpolateRgb("#FC4E2A", "#FD8D3C");

      return function(d) {
        if (d.idi <= 2) {
          return isoInterp(d.idi);
        }
        if (d.idi <= 3.3) {
          return nearInterp(d.idi);
        }
        if (d.idi <= 5) {
          return '#4292c6';
        }
        return '#084594';
      };
    };

    var defaults = {
      klass: function(d) {
          var klasses = ["cell"];
          if (d.__row === d.__column) {
            klasses.push("diagonal");
          }
          return klasses.join(' ');
        },
      fill: this.idiFill(),
      getFirstItem: function(d) { return d.items[0]; },
      getSecondItem: function(d) { return d.items[1]; },
      getItems: function(d) { return d.items; },
    };

    generateComponent.call(this, plot, defaults, options);

    this.preprocess = function(pairs) {
      var ordered = [],
          rowIndex = 0,
          colIndex = 0,
          getFirst = this.getFirstItem();

      pairs.forEach(function(data, globalIndex) {
        if (ordered.length > 0 &&
            getFirst(data) !== getFirst(ordered[ordered.length - 1])) {
          rowIndex = 0;
          colIndex += 1;
        }
        var computed = {
          __current: globalIndex,
          __row: rowIndex,
          __column: colIndex
        };
        ordered.push(extend(computed, data));
        rowIndex += 1;
      });
      this.ordered(ordered);
      return ordered;
    };

    this.render = function(data) {
      var cellSize = this.cellSize();

      return this._plot.vis
        .append("g")
        .attr("class", "cells")
        .selectAll(".cell")
        .data(data)
        .enter().append("rect")
          .attr("class", this.klass())
          .attr("x", function(d) { return d.__row * cellSize; })
          .attr("y", function(d) { return d.__column * cellSize; })
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr("fill", this.fill())
          .attr('stroke', 'white')
          .attr('stroke-width', 1)
          .attr('opacity', 1)
          .on('click', this.click());
    };

  };

  var generateLabel = function(plot, options) {

    generateComponent.call(this, plot, {}, options);

    this.x = function() { return function() { return 0; }; };
    this.y = function() { return function() { return -2; }; };

    this.render = function(labels) {
      return this.vis
        .append('g')
        .selectAll('.' + this.klass())
        .data(labels)
        .enter().append('text')
          .attr('class', this.klass())
          .text(String)
          .attr('x', this.x())
          .attr('y', this.y());
    };

    return this;
  };

  var generateMark = function(plot, type, options) {
    var defaults = {
      klass: 'mark',
      onlyDiagonal: true,
      areaPercent: 0.6,
      rotation: false
    };

    this._type = type;

    generateComponent.call(this, plot, defaults, options);

    this.size = function() {
      return Math.pow(this.cellSize(), 2) / this.areaPercent;
    };

    this.preprocess = function(sequences) {
      var map = {},
          getID = this._plot.pairs.getID(),
          getItems = this._plot.pairs.getItems(),
          onlyDiagonal = this.onlyDiagonal();

      sequences.forEach(function(s) { map[s] = true; });

      return this._plot.ordered().filter(function(data) {
        var id = getID(data),
            items = getItems(data);

        return (!onlyDiagonal && map[id]) ||
               (onlyDiagonal && data.__row === data.__column && map[items[0]]);
      });
    };

    this.translate = function() {
      var cellSize = this.cellSize(),
          close = '';

      if (this.rotation()) {
        close = 'rotate(' + this.rotation() + ')';
      }

      return function(d) {
        var x = d.__row * cellSize,
            y = d.__column * cellSize;
        return 'translate(' + x + ',' + y + ')' + close;
      };
    };

    this.render = function(marks) {

      var generator = d3.symbol()
        .type(this._type)
        .size(this.size());

      this.plot._vis.selectAll('#diagonal-marks').remove();

      return this._plot.vis
        .append('g')
        .selectAll(".diagonal-mark")
        .data(marks)
        .enter().append('circle')
          .attr('class', this.klass())
          .attr('d', generator)
          .attr('transform', this.translate())
          .attr('pointer-events', 'none');
    };
  };

  var generateLegend = function(plot, options) {
    var defaults = {
      height: 10,
      fill: plot.pairs.idiFill()
    };

    generateComponent.call(this, plot, defaults, options);
    this.labels = generateLegendLabel.call({}, this, plot, options.labels || {});

    this.render = function(data) {
      var y = this.cellSize() * this.labels().length + 20,
          size = this.size(),
          width = size / this.legend().length,
          legend = this.vis
            .selectAll('legend')
            .append('g')
              .attr('id', 'legend');

      legend.append('g')
        .attr('id', 'legend-cells')
        .data(data)
        .enter().append('rect')
          .attr('class', this.klass())
          .attr('x', function(_, i) { return width * i; })
          .attr('y', y)
          .attr('width', width)
          .attr('height', this.legendSize())
          .attr('stroke-width', this.strok)
          .attr('fill', this.fill());

      this._vis = legend;
      this.labels.render(data);

      return legend;
    };
  };

  var generateLegendLabel = function(legend, plot, options) {
    var defaults = {
      klass: 'legend-label',
      tickCount: 10
    };

    generateLabel.call(this, plot, defaults, options);

    this._legend = legend;
    this.size = function() { return this._legend.size(); };

    this.render = function(values) {
      var legend = this._legend.vis,
          size = this.size(),
          scale = d3.scale.linear().domain(values),
          labelData = scale.ticks(this.tickCount()),
          tickCount = labelData.length;

      return legend.append('g')
        .data(labelData)
        .enter().append('text')
          .attr('class', this.klass())
          .attr('x', function(_, i) { return (size / tickCount) * i; })
          .attr('y', this.y()) // y - this._legend.size() + 8)
          .attr('text-anchor', 'middle')
          .text(String);
    };
  };

  function HeatMap(config) {
    var self = this,
      defaults = {
        margin: 30,
        size:  550,
        selection: null,
        ordered: [],
        known: {},
        addDefinitions: Object,
        legend: null,
      };

    this.marks = {};
    this.marks.draw = function() {
      Object.keys(self.marks).forEach(function(name) {
        self.marks[name].draw();
      });
    };

    this.pairs = accessor([], function(_, pairs) {
      self.known(self.computeKnown(pairs));
    });

    var conf = extend({}, defaults, config);
    Object.keys(defaults).forEach(function(k) { self[k] = accessor(conf[k]); });

    generateCell.call(this.pairs, this, config.pairs || {});

    this.addMark('active', 'circle')
      .attr('fill', 'black')
      .attr('opacity', 1);

    this.addMark('missing', 'cross')
      .rotation(45)
      .attr('fill', 'red')
      .attr('opacity', 0.7);

    generateLegend.call(this.legend, this, config.legend || {});

    // TODO: X labels
    // TODO: Y labels
  }

  HeatMap.prototype.addMark = function(name, type, config) {
    this.marks[name] = accessor([]);
    generateMark.call(this.marks[name], this, type, config || {});
    return this.marks[name];
  };

  HeatMap.prototype.computeKnown = function(pairs) {
    var known = {},
        getItems = this.pairs.getItems();
    pairs.forEach(function(pair) {
      var items = getItems(pair);
      items.forEach(function(item) {
        var key = item.toUpperCase();
        known[key] = known[key] || [];
        if (known[key].indexOf(item) === -1) {
          known[key].push(item);
        }
      });
    });

    return known;
  };

  HeatMap.prototype.cellSize = function(count) {
    if (arguments.length === 0) {
      return this.size() / this.labels().length;
    }
    return (this.size() / count);
  };

  HeatMap.prototype.labels = function() {
    var seen = {},
        names = [],
        getFirst = this.pairs.getFirstItem();

    this.pairs().forEach(function(d) {
      var first = getFirst(d);
      if (!seen.hasOwnProperty(first)) {
        names.push(first);
        seen[first] = true;
      }
    });
    return names;
  };

  HeatMap.prototype.draw = function() {
    var margin = this.margin(),
        selection = d3.select(this.selection());

    selection.select('svg').remove();

    var self = this,
        top = selection.append('svg'),
        defs = top.append('svg:defs'),
        defFn = this.addDefinitions();

    top.attr('width', this.size() + margin * 2)
      .attr('height', this.size() + margin * 2);

    defFn.call(this, defs);

    this.vis = top.append("g")
      .attr("transform",
          "translate(" + margin + "," + margin + ")");

    // this.labels.draw(this.labels());
    this.pairs.draw(this.pairs());
    // self.marks.draw();

    if (this.legend()) {
      this.legend.draw(this.legend());
    }

    return this;
  };

  HeatMap.prototype.getPairsInRange = function(d, i) {

    if (d.__row === d.__column) {
      return [d];
    }

    var getItems = this.getItems(),
        items = getItems(d, i),
        getFirst = this.getFirstItem(),
        diagonal = this.ordered()
          .filter(function(d) { return d.__row === d.__column; }),
        firsts = diagonal.map(function(d) { return getFirst(d); });

    if (d.__row < d.__column) {
        var stop = firsts.indexOf(items[0]) + 1,
            start = firsts.indexOf(items[1]);
        return diagonal.slice(start, stop);
    }

    return [diagonal[firsts.indexOf(items[1])],
            diagonal[firsts.indexOf(items[0])]];
  };

  window.HeatMap = window.HeatMap || HeatMap;
}());

  // HeatMap.prototype.show = function(sequences) {
  //   var map = {},
  //       getID = this.getID(),
  //       getItems = this.getItems(),
  //       onlyDiagonal = this.showOnlyDiagonal();
  //   sequences.forEach(function(s) { map[s] = true; });
  //   var pairs = $.map(this.ordered(), function(data) {
  //     var id = getID(data),
  //         items = getItems(data);
  //     if ((!onlyDiagonal && map[id]) ||
  //         (onlyDiagonal && data.__row === data.__column && map[items[0]])) {
  //       return data;
  //     }
  //     return null;
  //   });
  //   this.mark(pairs);
  // };


  // TODO: Implement me
  // HorizontalLabel.prototype.y = function() { };

  // // TODO: Implement me
  // VerticalLabel.prototype.y = function() { };











  // HeatMap.prototype.drawLabels = function() {
  //   var cellSize = this.cellSize(),
  //       labels = this.labels();
  //   // Row Labels
  //   this.vis
  //     .append('g')
  //     .selectAll('.row-labels')
  //     .data(labels)
  //     .enter().append('text')
  //       .attr('id', function(_, i) { return 'row-label-' + i; })
  //       .attr('class', function() { return 'row-labels'; })
  //       .text(String)
  //       .attr('x', 0)
  //       .attr('y', function(d, i) { return i * cellSize; })
  //       .style("text-anchor", "end")
  //       .attr("transform", "translate(-6," + cellSize / 1.5 + ")");
  // // Column Labels
  // var translate = '';
  // if (this.rotateColumns()) {
  //   translate = function(d, i) {
  //     var x = i * cellSize + (cellSize/2);
  //     return "rotate(-90 " + x + ",-2)";
  //   };
  // }
  // this.vis
  //   .append("g")
  //     .selectAll(".col-labels")
  //     .data(labels)
  //     .enter().append("text")
  //       .attr('id', function(_, i) { return 'col-label-' + i; })
  //       .attr('class', function() { return 'col-labels'; })
  //       .text(String)
  //       .attr("x", function (d, i) { return i * cellSize + (cellSize/2); })
  //       .attr("y", -2)
  //       .style("text-anchor", "left")
  //       .attr("transform", translate);
  // };
  // HeatMap.prototype.drawCells = function() {
  //   var cellSize = this.cellSize(),
  //       ordered = [],
  //       rowIndex = 0,
  //       colIndex = 0,
  //       getFirst = this.getFirstItem();
  //   this.pairs().forEach(function(data, globalIndex) {
  //     if (ordered.length > 0 &&
  //         getFirst(data) !== getFirst(ordered[ordered.length - 1])) {
  //       rowIndex = 0;
  //       colIndex += 1;
  //     }
  //     var computed = {
  //       __current: globalIndex,
  //       __row: rowIndex,
  //       __column: colIndex
  //     };
  //     ordered.push(extend(computed, data));
  //     rowIndex += 1;
  //   });
  //   this.ordered(ordered);
  //   // Draw the boxes
  //   var self = this;
  //   this.vis
  //     .append("g")
  //     .attr("class", "cells")
  //     .selectAll(".cell")
  //     .data(ordered)
  //     .enter().append("rect")
  //       .attr('id', function(_, i) { return 'cell-' + i; })
  //       .attr("class", function(d) {
  //         var klasses = ["cell"];
  //         if (d.__row === d.__column) {
  //           klasses.push("diagonal");
  //         }
  //         return klasses.join(' ');
  //       })
  //       .attr("x", function(d) { return d.__row * cellSize; })
  //       .attr("y", function(d) { return d.__column * cellSize; })
  //       .attr("width", cellSize)
  //       .attr("height", cellSize)
  //       .attr("fill", this.fill())
  //       .attr('stroke', 'white')
  //       .attr('stroke-width', 1)
  //       .attr('opacity', this.opacity())
  //       .on('click', self.click());
  // };

  // HeatMap.prototype.drawLegend = function() {
  //   var y = this.cellSize() * this.labels().length + 20,
  //       size = this.size(),
  //       width = size / this.legend().length,
  //       legend = this.vis
  //         .selectAll('legend')
  //         .append('g')
  //           .attr('id', 'legend');

  //   legend.append('g')
  //     .attr('id', 'legend-cells')
  //     .data(this.legend())
  //     .enter().append('rect')
  //       .attr('id', function(_, i) { return 'legend-' + i; })
  //       .attr('class', 'legend-cell')
  //       .attr('x', function(_, i) { return width * i; })
  //       .attr('y', y)
  //       .attr('width', width)
  //       .attr('height', this.legendSize())
  //       .attr('stroke-width', 0)
  //       .attr('fill', this.fill());

  //   var tickCount = 10,
  //       values = this.legend().map(function(d) { return d.value; }),
  //       scale = d3.scale.linear().domain(values),
  //       labelData = scale.ticks(tickCount);

  //   tickCount = labelData.length;

  //   legend.append('g')
  //     .attr('id', 'legend-text')
  //     .data(labelData)
  //     .enter().append('text')
  //       .attr('x', function(_, i) { return (size / tickCount) * i; })
  //       .attr('y', y - this.legendSize() + 8)
  //       .attr('text-anchor', 'middle')
  //       .text(String);

  //   $(".legend-cell").tipsy({
  //     gravity: 'se',
  //     html: 'true',
  //     title: function() {
  //       return this.__data__.label;
  //     }
  //   });
  // };
