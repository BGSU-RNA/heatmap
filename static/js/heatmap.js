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

  function HeatMapPlot(config) {
    var self = this;
    var defaults = {
      margin: 30,
      size:  550,
      selection: null,
      ordered: [],
      known: {},
      getFirstItem: function(d) { return d.items[0]; },
      getSecondItem: function(d) { return d.items[1]; },
      getItems: function(d) { return d.items; },
      getID: function(d) { return d.id; },
      fill: this.colorScale(),
      click: Object,
      addDefinitions: Object,
      legend: null,
      legendSize: 10,
      rotateColumns: true,
      showOnlyDiagonal: true,
      markFill: 'black',
      markOpacity: 1,
      opacity: '1'
    };

    this.pairs = accessor([], function(_, pairs) {
      self.known(self.computeKnown(pairs));
    });

    var conf = extend({}, defaults, config);
    Object.keys(defaults).forEach(function(k) { self[k] = accessor(conf[k]); });
  }

  HeatMapPlot.prototype.computeKnown = function(pairs) {
    var known = {},
        getItems = this.getItems();
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

  HeatMapPlot.prototype.cellSize = function(count) {
    if (arguments.length === 0) {
      return this.size() / this.labels().length;
    }
    return (this.size() / count);
  };

  HeatMapPlot.prototype.labels = function() {
    var seen = {},
        names = [],
        getFirst = this.getFirstItem();

    this.pairs().forEach(function(d) {
      var first = getFirst(d);
      if (!seen.hasOwnProperty(first)) {
        names.push(first);
        seen[first] = true;
      }
    });
    return names;
  };

  HeatMapPlot.prototype.drawLabels = function() {
    var cellSize = this.cellSize(),
        labels = this.labels();

    // Row Labels
    this.vis
      .append('g')
      .selectAll('.row-labels')
      .data(labels)
      .enter().append('text')
        .attr('id', function(_, i) { return 'row-label-' + i; })
        .attr('class', function() { return 'row-labels'; })
        .text(String)
        .attr('x', 0)
        .attr('y', function(d, i) { return i * cellSize; })
        .style("text-anchor", "end")
        .attr("transform", "translate(-6," + cellSize / 1.5 + ")");

  // Column Labels
  var translate = '';
  if (this.rotateColumns()) {
    translate = function(d, i) {
      var x = i * cellSize + (cellSize/2);
      return "rotate(-90 " + x + ",-2)";
    };
  }

  this.vis
    .append("g")
      .selectAll(".col-labels")
      .data(labels)
      .enter().append("text")
        .attr('id', function(_, i) { return 'col-label-' + i; })
        .attr('class', function() { return 'col-labels'; })
        .text(String)
        .attr("x", function (d, i) { return i * cellSize + (cellSize/2); })
        .attr("y", -2)
        .style("text-anchor", "left")
        .attr("transform", translate);
  };

  HeatMapPlot.prototype.drawCells = function() {
    var cellSize = this.cellSize(),
        ordered = [],
        rowIndex = 0,
        colIndex = 0,
        getFirst = this.getFirstItem();

    this.pairs().forEach(function(data, globalIndex) {
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

    // Draw the boxes
    var self = this;
    this.vis
      .append("g")
      .attr("class", "cells")
      .selectAll(".cell")
      .data(ordered)
      .enter().append("rect")
        .attr('id', function(_, i) { return 'cell-' + i; })
        .attr("class", function(d) {
          var klasses = ["cell"];
          if (d.__row === d.__column) {
            klasses.push("diagonal");
          }
          return klasses.join(' ');
        })
        .attr("x", function(d) { return d.__row * cellSize; })
        .attr("y", function(d) { return d.__column * cellSize; })
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr("fill", this.fill())
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', this.opacity())
        .on('click', self.click());
  };

  HeatMapPlot.prototype.drawLegend = function() {
    var y = this.cellSize() * this.labels().length + 20,
        size = this.size(),
        width = size / this.legend().length,
        legend = this.vis
          .selectAll('legend')
          .append('g')
            .attr('id', 'legend');

    legend.append('g')
      .attr('id', 'legend-cells')
      .data(this.legend())
      .enter().append('rect')
        .attr('id', function(_, i) { return 'legend-' + i; })
        .attr('class', 'legend-cell')
        .attr('x', function(_, i) { return width * i; })
        .attr('y', y)
        .attr('width', width)
        .attr('height', this.legendSize())
        .attr('stroke-width', 0)
        .attr('fill', this.fill());


    var tickCount = 10,
        values = this.legend().map(function(d) { return d.value; }),
        scale = d3.scale.linear().domain(values),
        labelData = scale.ticks(tickCount);

    tickCount = labelData.length;

    legend.append('g')
      .attr('id', 'legend-text')
      .data(labelData)
      .enter().append('text')
        .attr('x', function(_, i) { return (size / tickCount) * i; })
        .attr('y', y - this.legendSize() + 8)
        .attr('text-anchor', 'middle')
        .text(String);

    $(".legend-cell").tipsy({
      gravity: 'se',
      html: 'true',
      title: function() {
        return this.__data__.label;
      }
    });
  };

  HeatMapPlot.prototype.draw = function() {
    var margin = this.margin(),
        selection = d3.select(this.selection());

    selection.select('svg').remove();

    var top = selection.append('svg'),
        defs = top.append('svg:defs'),
        defFn = this.addDefinitions();

    top.attr('width', this.size() + margin * 2)
      .attr('height', this.size() + margin * 2);

    defFn.call(this, defs);

    this.vis = top.append("g")
      .attr("transform",
          "translate(" + margin + "," + margin + ")");

    this.drawLabels();
    this.drawCells();
    if (this.legend()) {
      this.drawLegend();
    }

    return this;
  };

  HeatMapPlot.prototype.colorScale = function() {
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

  HeatMapPlot.prototype.getPairsInRange = function(d, i) {
    var getItems = this.getItems();
    if (d.__row < d.__column) {
      return this.range(getItems(d, i));
    }
    if (d.__row === d.__column) {
      return [d];
    }

    var items = getItems(d, i),
        getFirst = this.getFirstItem(),
        diagonal = this.ordered()
          .filter(function(d) { return d.__row === d.__column; }),
        firsts = diagonal.map(function(d) { return getFirst(d); });

    return [diagonal[firsts.indexOf(items[1])],
            diagonal[firsts.indexOf(items[0])]];
  };

  HeatMapPlot.prototype.mark = function(pairs) {
    var cellSize = this.cellSize(),
        percent = 0.60,
        radius = Math.sqrt(percent * Math.pow(cellSize, 2) / Math.PI);

    this.vis.selectAll('#diagonal-marks').remove();

    this.vis
      .append('g')
      .attr('id', 'diagonal-marks')
      .selectAll(".diagonal-mark")
      .data(pairs)
      .enter().append('circle')
        .attr("cx", function(d) {
          return d.__row * cellSize + cellSize / 2;
        })
        .attr("cy", function(d) {
          return d.__column * cellSize + cellSize / 2;
        })
        .attr('r', radius)
        .attr('fill', this.markFill())
        .attr('opacity', this.markOpacity());
  };

  HeatMapPlot.prototype.show = function(sequences) {
    var map = {},
        getID = this.getID(),
        getItems = this.getItems(),
        onlyDiagonal = this.showOnlyDiagonal();

    sequences.forEach(function(s) { map[s] = true; });

    var pairs = $.map(this.ordered(), function(data) {
      var id = getID(data),
          items = getItems(data);

      if ((!onlyDiagonal && map[id]) ||
          (onlyDiagonal && data.__row === data.__column && map[items[0]])) {
        return data;
      }
      return null;
    });

    this.mark(pairs);
  };

  HeatMapPlot.prototype.range = function(pair) {
    var getFirst = this.getFirstItem(),
        diagonal = this.ordered()
          .filter(function(d) { return d.__row === d.__column; }),
        firsts = diagonal.map(function(d) { return getFirst(d); }),
        stop = firsts.indexOf(pair[0]) + 1,
        start = firsts.indexOf(pair[1]);

    return diagonal.slice(start, stop);
  };

  window.HeatMap = window.HeatMap || HeatMapPlot;
}());
