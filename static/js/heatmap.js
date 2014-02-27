(function () {
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

(function (global, factory) {
  if (typeof define === "function" && define.amd) { define(factory); }
  else if (typeof module === "object") { module.exports = factory(); }
  else { global.augment = factory(); }
}(this, function () {
  "use strict";

  var Factory = function () {};
  var slice = Array.prototype.slice;

  return function (base, body) {
    var uber = Factory.prototype = typeof base === "function" ? base.prototype : base;
    var prototype = new Factory;
    body.apply(prototype, slice.call(arguments, 2).concat(uber));
    if (!prototype.hasOwnProperty("constructor")) return prototype;
    var constructor = prototype.constructor;
    constructor.prototype = prototype;
    return constructor;
  };
}));

function dispatch(obj, method) {
  return function() { return obj[method].apply(obj, arguments); };
}

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
      getText: String,
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
      .text(this.getText())
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
      'gap': 2,
    };

    this._legend = legend;
    this.ticks = dispatch(this._legend, 'ticks');

    parent.constructor.call(this, plot, 'legend', defaults);

    this.getText = dispatch(this._legend, 'getText');
    this.getValue = dispatch(this._legend, 'getValue');
  };

  this.x = function() {
    var fn = this._legend.x();
    return function(d) { return fn(d, d.__index); };
  };

  this.y = function() {
    return this._legend.y() - this.gap();
  };

  this.preprocess = function() {
    var data = this._legend.data();
    if (!data) {
      return data;
    }
    var getValue = this.getValue(),
        scale = d3.scale.linear().domain(data.map(getValue)),
        ticks = scale.ticks(this.ticks());

    return data.map(function(d, i) {
      d.__index = i;
      return d;
    }).filter(function(d) {
      return ticks.indexOf(getValue(d)) !== -1;
    });
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
      ticks: 10,
      getText: function(d) { return d.value; },
      getValue: function(d) { return d.value; },
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
        data = this.data(),
        getID = this.getID();

    if (typeof data[0] !== 'string') {
      return data;
    }

    data.forEach(function(s) { map[s] = true; });

    return this.ordered().filter(function(data) { return map[getID(data)]; });
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

var HeatMap = augment(Object, function() {
  'use strict';

  this.constructor = function(config) {
    var self = this,
      defaults = {
        margin: 30,
        size:  550,
        selection: null,
        addDefinitions: Object,
        getFirstItem: function(d) { return d.items[0]; },
        getSecondItem: function(d) { return d.items[1]; },
        getItems: function(d) { return d.items; },
        getID: function(d) { return d.id; },
      };

    this.ordered = accessor([]);
    this.known = accessor([]);

    this.data = accessor([], function(_, pairs) {
      self.known(self.computeKnown(pairs));
    });

    var conf = extend({}, defaults, config);
    Object.keys(defaults).forEach(function(k) { self[k] = accessor(conf[k]); });

    this.cells = new Cell(this);
    this.marks = new MarkSet(this);
    this.legend = new Legend(this);
    this.labels = new LabelSet(this);

    this.marks.add('active')
      .type('circle')
      .attr('fill', 'black')
      .attr('opacity', 1);

    this.marks.add('missing')
      .type('cross')
      .rotation(45)
      .attr('fill', 'red')
      .attr('opacity', 0.7);
  };

  this.computeKnown = function(pairs) {
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

  this.cellSize = function(count) {
    if (arguments.length === 0) {
      return this.size() / this.rows().length;
    }
    return (this.size() / count);
  };

  this.draw = function() {
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

    this.labels.draw();
    this.cells.draw(this.data());
    this.marks.draw();
    this.legend.draw();

    return this;
  };

  this.getPairsInRange = function(d, i) {

    if (d.__row === d.__column) {
      return [d];
    }

    var items = this.getItems()(d, i),
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

  function uniqueFromPair(obj, data, index) {
    var getItems = obj.getItems(),
        seen = {},
        unique = [];

    data.forEach(function(datum) {
      var current = getItems(datum)[index];
      if (!seen[current]) {
        unique.push(current);
        seen[current] = true;
      }
    });
    return unique;
  }

  this.columns = function() { return uniqueFromPair(this, this.data(), 0); };

  this.rows = function() { return uniqueFromPair(this, this.data(), 1); };
});

  window.HeatMap = window.HeatMap || HeatMap;
}());
