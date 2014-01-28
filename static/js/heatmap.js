(function () {
  'use strict';
  /*globals window, d3, document, $, jmolApplet, jmolScript */

  var HeatMap = window.HeatMap || function(config) {

    var plot = function(data) {

      var margin = plot.margin(),
          selection = d3.select(plot.selection());

      selection.select('svg').remove();

      var top = selection.append('svg')
        .attr('width', plot.width() + margin.left + margin.right)
        .attr('height', plot.height() + margin.above + margin.below);

      plot.vis = top.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.above + ")");

      plot.draw(data);

      return plot;
    };

    $.each(HeatMap, function(name, fn) {
      plot[name] = fn.bind(plot);
    });

    plot.generateAccessors($.extend({
      margin: { left: 30, right: 30, above: 30, below: 30 },
      width:  550,
      height: 550,
      selection: null,
      cellSize: function() { return 80; },
      ordered: [],
      nts: {},
      pairs: [],
      click: Object
    }, config));

    return plot;
  };

  window.HeatMap = HeatMap;

  HeatMap.generateAccessors = function(state, callback) {
    var obj = this;
    $.each(state, function(key, value) {
      obj[key] = (function() {
        return function(x) {
          if (!arguments.length) {
            return state[key];
          }
          var old = state[key];
          state[key] = x;
          if (callback && callback[key]) {
            callback[key](old, x);
          }
          return obj;
        };
      }());
    });
  };

  HeatMap.labels = function() {
    var seen = {},
        names = [];

    $.each(this.pairs(), function(_, d) {
      var first = d.first;
      if (!seen.hasOwnProperty(first)) {
        names.push(first);
        seen[first] = true;
      }
    });
    return names;
  };

  HeatMap.draw = function(data) {

    var pairs = data.pairs,
        nts = data.nts;

    this.nts(nts);
    this.pairs(pairs);

    var cellSize = this.cellSize()(),
        colorScale = this.colorScaleBuilder(),
        labels = this.labels();

    // Row Labels
    var rowLabels = this.vis
      .append('g')
      .selectAll('.row-labels')
      .data(labels)
      .enter().append('text')
        .attr('id', function(d, i) { return 'row-label-' + i; })
        .attr('class', function(d, i) { return 'row-labels'; })
        .text(function(d, i) { return d; })
        .attr('x', 0)
        .attr('y', function(d, i) { return i * cellSize; })
        .style("text-anchor", "end")
        .attr("transform", "translate(-6," + cellSize / 1.5 + ")");

  // Column Labels
  var colLabels = this.vis
    .append("g")
      .selectAll(".col-labels")
      .data(labels)
      .enter().append("text")
        .attr('id', function(d, i) { return 'col-label-' + i; })
        .attr('class', function(d, i) { return 'col-labels'; })
        .text(function (d) { return d; })
        .attr("x", 0)
        .attr("y", function (d, i) { return i * cellSize; })
        .style("text-anchor", "left")
        .attr("transform", "translate(" + cellSize/2 + ",-6) rotate (-90)");

  var ordered = [],
      rowIndex = 0,
      colIndex = 0;
  $.each(pairs, function(globalIndex, data) {
    if (ordered.length > 0 && data.first !== ordered[ordered.length - 1].first) {
      rowIndex += 1;
      colIndex = 0;
    }
    var computed = {
      __current: globalIndex,
      __row: rowIndex,
      __column: colIndex
    };
    ordered.push($.extend(computed, data));
    colIndex += 1;
  });
  this.ordered(ordered);

  // Draw the boxes
  var plot = this,
      heatMap = this.vis
      .append("g")
      .attr("class", "cells")
        .selectAll(".cell")
        .data(ordered)
        .enter().append("rect")
          .attr('id', function(d, i) { return 'cell-' + i; })
          .attr("class", function(d, i) { return "cell"; })
          .attr("x", function(d, i) { return d.__row * cellSize; })
          .attr("y", function(d, i) { return d.__column * cellSize; })
          .attr("width", cellSize)
          .attr("height", cellSize)
          .attr("fill", colorScale)
          .on('click', function(d, i) {
            var fn = plot.click();
            fn.call(plot, d, i, this);
          });
  };

  HeatMap.colorScaleBuilder = function() {
    var scale = d3.scale.linear()
      .domain([0, 2, 3, 6])
      .range(["#d7191c", "#fdae61", "#abd9e9", "#2c7bb6"]);

    return function(d, i) { return scale(d.idi); };
  };

  HeatMap.getPairs = function(d, i) {
    if (d.__row < d.__column) {
      return this.range(d.first, d.second);
    }
    return [d.first, d.second];
  };

  HeatMap.mark = function(ids) {
  };

  HeatMap.unmark = function(ids) {
  };

  HeatMap.show = function(sequences) {
    var nts = this.nts(),
        ids = $.map(sequences, function(o, _) { return nts[o]; });
    this.mark(ids);
  };

  HeatMap.range = function(first, second) {
    var ordered = this.ordered(),
        showable = false,
        sequences = [];

    $.each(ordered, function(_, obj) {
      if (obj.first === first) {
        showable = true;
      }
      if (showable) {
        sequences.push(obj.first);
        sequences.push(obj.second);
      }
      if (obj.second === second) {
        showable = false;
      }
    });
    return sequences;
  };

}());
