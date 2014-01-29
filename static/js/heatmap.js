(function () {
  'use strict';
  /*globals window, d3, document, $, jmolApplet, jmolScript */

  var HeatMap = window.HeatMap || function(config) {

    var plot = function(data) {

      var margin = plot.margin(),
          selection = d3.select(plot.selection());

      selection.select('svg').remove();

      var top = selection.append('svg')
        .attr('width', plot.size() + margin.left + margin.right)
        .attr('height', plot.size() + margin.above + margin.below);

      top.append('defs')
        .append('pattern')
          .attr('id', 'diagonalHatch')
          .attr('patternUnits', 'userSpaceOnUse')
          .attr('width', 4)
          .attr('height', 4)
        .append('path')
          .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
          .attr('stroke', '#000000')
          .attr('stroke-width', 1);

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
      size:  550,
      selection: null,
      ordered: [],
      nts: {},
      pairs: [],
      click: Object
    }, config));

    return plot;
  };

  window.HeatMap = HeatMap;

  HeatMap.cellSize = function() {
    var labels = this.labels().length;
    return (this.size() / labels)
  };

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

    var cellSize = this.cellSize(),
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
  var plot = this;
  this.vis
    .append("g")
    .attr("class", "cells")
    .selectAll(".cell")
    .data(ordered)
    .enter().append("rect")
      .attr('id', function(d, i) { return 'cell-' + i; })
      .attr("class", function(d, i) { 
        var klasses = ["cell"];
        if (d.__row === d.__column) {
          klasses.push("diagonal");
        }
        return klasses.join(' '); 
      })
      .attr("x", function(d, i) { return d.__row * cellSize; })
      .attr("y", function(d, i) { return d.__column * cellSize; })
      .attr("width", cellSize)
      .attr("height", cellSize)
      .attr("fill", colorScale)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('click', function(d, i) {
        var fn = plot.click();
        fn.call(plot, d, i, this);
      });
  };

  HeatMap.colorScaleBuilder = function() {
    var scale = d3.scale.linear()
      .domain([0, 2, 3, 100])
      .range(["#d7191c", "#fdae61", "#abd9e9", "#2c7bb6"]);

    return function(d, i) { return scale(d.idi); };
  };

  HeatMap.getPairs = function(d, i) {
    if (d.__row < d.__column) {
      return this.range(d.first, d.second);
    }
    return [d.first, d.second];
  };

  HeatMap.mark = function(pairs) {
    var colorScale = this.colorScaleBuilder(),
        cellSize = this.cellSize(),
        percent = 0.50,
        radius = Math.sqrt(percent * cellSize^2 / Math.PI);

    this.vis.selectAll('#diagonal-marks').remove();

    this.vis
      .append('g')
      .attr('id', 'diagonal-marks')
      .selectAll(".diagonal-mark")
      .data(pairs)
      .enter().append('circle')
        .attr("cx", function(d, i) { 
          return d.__row * cellSize + cellSize / 2; 
        })
        .attr("cy", function(d, i) { 
          return d.__column * cellSize + cellSize / 2;
        })
        .attr('r', radius)
        .attr('fill', 'black');
  };

  HeatMap.show = function(sequences) {
    var map = {};
    $.each(sequences, function(_, s) { map[s] = true; });

    var pairs = $.map(this.ordered(), function(data, _) {
      console.log(data);
      if (data.__row === data.__column && map[data.first]) {
        return data;
      }
      return null;
    });
    this.mark(pairs);
  };

  HeatMap.range = function(first, second) {
    var ordered = this.ordered(),
        showable = false,
        seen = {};

    $.each(ordered, function(_, obj) {
      if (obj.first === first) {
        showable = true;
      }
      if (showable) {
        seen[obj.first] = true;
      }
      if (obj.first === second) {
        showable = false;
      }
    });
    return $.map(seen, function(_, sequence) { return sequence; });
  };

}());
