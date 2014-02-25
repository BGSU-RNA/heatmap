/* globals augment, extend, accessor, d3, Cell, MarkSet, Legend, LabelSet */

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
