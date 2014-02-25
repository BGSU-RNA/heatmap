/* globals extend, augment, accessor, d3, dispatch */

var Component = augment(Object, function () {
  'use strict';

  this.constructor = function(plot, type, defaults) {
    var self = this,
        standard = {click: Object},
        config = extend({}, standard, defaults);

    this._plot = plot;
    this._type = type;
    this._attrs = [];
    this.cellSize = dispatch(plot, 'cellSize');
    this.ordered = dispatch(plot, 'ordered');
    this.getItems = dispatch(plot, 'getItems');
    this.getFirstItem = dispatch(plot, 'getFirstItem');
    this.getSecondItem = dispatch(plot, 'getSecondItem');
    this.getID = dispatch(plot, 'getID');
    this.columns = dispatch(plot, 'columns');
    this.rows = dispatch(plot, 'rows');

    Object.keys(config).forEach(function(key) {
      self[key] = accessor(config[key]);
    });

    return this;
  };

  this.attr = function(key, value) {
    this._attrs.push({key: key, value: value});
    return this;
  };

  this.preprocess = function(d) {
    if (d) {
      return d;
    }
    return (this.data ? this.data() : []);
  };

  this.selector = function() { return '.' + this.groupClass(); };

  this.clear = function() {
    this._plot.vis.selectAll(this.selector()).remove();
    return this;
  };

  /**
   * Draw this component
   **/
  this.draw = function(raw) {
    var self = this,
        data = this.preprocess(raw);

    if (!data || !data.length) {
      return this;
    }

    this.clear().
      _plot.vis
        .append('g')
        .attr('class', this.groupClass())
        .selectAll(this.selector())
        .data(data).enter()
        .append(this._type)
        .attr('class', this.klass())
        .call(function(selection) { self.render.call(self, selection, data); })
        .call(function (selection) {
          self._attrs.forEach(function(attr) {
            selection.attr(attr.key, attr.value);
          });
        })
        .on('click', this.click());

    return this;
  };

});

var Label = augment(Component, function(parent) {
  'use strict';

  this.constructor = function(plot, type, opts) {
    var defaults = {
      groupClass: type + '-labels',
      klass: type + '-label',
      rotate: true,
      'text-anchor': 'end',
    };

    parent.constructor.call(this, plot, 'svg:text', extend(defaults, opts));
  };

  this.x = function() { return function() { return 0; }; };
  this.y = function() { return function() { return -2; }; };

  this.transform = function() {
    var self = this,
        translate = '';
    if (this.rotate()) {
      translate = function(d, i) {
        var cellSize = self.cellSize(),
            x = i * cellSize + (cellSize/2);
        return "rotate(-90 " + x + ",-2)";
      };
    }
    return translate;
  };

  this.render = function(selection) {
    selection
      .text(String)
      .attr('x', this.x())
      .attr('y', this.y())
      .attr('text-anchor', this['text-anchor']())
      .attr('transform', this.transform());
  };
});

var ColumnLabel = augment(Label, function(parent) {
  'use strict';

  this.constructor = function(plot) {
    parent.constructor.call(this, plot, 'column', {'text-anchor': 'left'});

    this.preprocess = dispatch(plot, 'columns');
  };

  this.x = function() {
    var cellSize = this.cellSize();
    return function (d, i) { return i * cellSize + (cellSize/2); };
  };
});

var RowLabel = augment(Label, function(parent) {
  'use strict';

  this.constructor = function(plot) {
    parent.constructor.call(this, plot, 'row', {rotate: false});

    this.preprocess = dispatch(plot, 'rows');
  };

  this.transform = function() {
    return "translate(-6," + this.cellSize() / 1.5 + ")";
  };

  this.y = function() {
    var cellSize = this.cellSize();
    return function(_, i) { return i * cellSize; };
  };
});

var LegendLabel = augment(Label, function(parent) {
  'use strict';

  this.constructor = function(plot, legend) {
    var defaults = {
      rotate: false,
      'text-anchor': 'middle',
    };
    this._legend = legend;
    parent.constructor.call(this, plot, 'legend', defaults);
  };

  this.x = function() { return this._legend.x(); };
  this.y = function() { return this._legend.y() - this._legend.size(); };

  this.preprocess = function() {
    var data = this._legend.data();
    return (data ? data.map(this._legend.getText()) : data);
  };
});

var Cell = augment(Component, function (parent) {
  'use strict';

  this.constructor = function (plot) {
    var defaults = {
      klass: function(d) {
        var klasses = ["cell"];
        if (d.__row === d.__column) {
          klasses.push("diagonal");
        }
        return klasses.join(' ');
      },
      groupClass: 'cells',
      fill: this.idiFill(),
    };

    parent.constructor.call(this, plot, 'svg:rect', defaults);
  };

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

  this.render = function(selection) {
    var cellSize = this.cellSize();

    selection
      .attr("x", function(d) { return d.__row * cellSize; })
      .attr("y", function(d) { return d.__column * cellSize; })
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", this.fill())
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 1);
  };
});

var Legend = augment(Component, function(parent) {
  'use strict';

  this.constructor = function(plot) {
    var defaults = {
      fill: plot.cells.fill(),
      klass: 'legend-cell',
      size: 10,
      groupClass: 'legend',
      gap: 20,
      getText: function(d) { return d.label; },
    };

    this.data = accessor([]);
    this.labels = new LegendLabel(plot, this);

    parent.constructor.call(this, plot, 'svg:rect', defaults);
  };

  this.draw = function() {
    parent.draw.apply(this, arguments);
    this.labels.draw();
  };

  this.x = function() {
    var plotSize = this.cellSize() * this.columns().length,
        width =  plotSize / this.data().length;
    return function(_, i) { return width * i; };
  };

  this.y = function() {
    return this.cellSize() * this.columns().length + this.gap();
  };

  this.render = function(selection, data) {
    var size = this.size(),
        plotSize = this.cellSize() * this.columns().length,
        width =  plotSize / data.length;

    selection
      .attr('x', this.x())
      .attr('y', this.y())
      .attr('width', width)
      .attr('height', size)
      .attr('stroke-width', 0)
      .attr('fill', this.fill());
  };
});

var Mark = augment(Component, function (parent) {
  'use strict';

  this.constructor = function(plot, name) {
    var defaults = {
      klass: 'mark',
      onlyDiagonal: true,
      fraction: 0.4,
      rotation: false,
      type: 'circle',
      groupClass: name + '-marks'
    };

    this.data = accessor([]);

    parent.constructor.call(this, plot, 'path', defaults);
  };

  this.size = function() {
    return this.fraction() * Math.pow(this.cellSize(), 2);
  };

  this.preprocess = function() {
    var map = {},
        getID = this.getID(),
        getItems = this.getItems(),
        onlyDiagonal = this.onlyDiagonal();

    this.data().forEach(function(s) { map[s] = true; });

    return this.ordered().filter(function(data) {
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
      var x = d.__row * cellSize + cellSize/2,
      y = d.__column * cellSize + cellSize/2;
      return 'translate(' + x + ',' + y + ')' + close;
    };
  };

  this.render = function(selection) {

    var generator = d3.svg.symbol()
      .type(this.type())
      .size(this.size());

    selection
      .attr('d', generator)
      .attr('transform', this.translate())
      .attr('pointer-events', 'none');
  };
});

var MarkSet = augment(Object, function() {
  'use strict';

  this.constructor = function(plot) {
    this._plot = plot;
    this._marks = [];
  };

  this.add = function(name) {
    if (!this._plot[name]) {
      this._plot[name] = new Mark(this._plot, name);
      this._marks.push(name);
    }
    return this._plot[name];
  };

  this.draw = function() {
    var self = this;
    this._marks.forEach(function(name) {
      self._plot[name].draw();
    });
  };
});

var LabelSet = augment(Object, function() {
  'use strict';

  this.constructor = function(plot) {
    this._plot = plot;
    this.row = new RowLabel(plot);
    this.column = new ColumnLabel(plot);
  };

  this.draw = function() {
    this.row.draw();
    this.column.draw();
    return this;
  };
});