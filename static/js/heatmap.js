(function () {
  'use strict';
  /*globals window, d3, document, $, jmolApplet, jmolScript */

  function accessor(initial) {
    return (function() {
      var value = initial;
      return function(x) {
        if (!arguments.length) {
          return value;
        }
        value = x;
        return this;
      };
    }());
  }

  function HeatMapPlot() { }

  HeatMapPlot.prototype.cellSize = function(count) {
    if (arguments.length === 0) {
      return this.size() / this.labels().length;
    }
    return (this.size() / count);
  };

  HeatMap.labels = function() {
    var seen = {},
        names = [],
        getFirst = this.pairs.getFirst();

    $.each(this.pairs(), function(_, d) {
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
  };

  HeatMapPlot.prototype.drawCells = function() {
    var pairs = this.items(),
        cellSize = this.cellSize()(),
        ordered = [],
        rowIndex = 0,
        colIndex = 0,
        getFirst = this.pairs.getFirst();

    $.each(pairs, function(globalIndex, data) {
      if (ordered.length > 0 && 
          getFirst(data) !== getFirst(ordered[ordered.length - 1])) {
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
    var self = this;
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
        .attr("fill", this.fillBuilder()())
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .on('click', self.click());
  };

  HeatMapPlot.prototype.draw = function() {
    this.drawLabels();
    this.drawCells();
  };

  HeatMapPlot.prototype.colorScaleBuilder = function() {
    var scale = d3.scale.linear()
      .domain([0, 2, 3, 100])
      .range(["#d7191c", "#fdae61", "#abd9e9", "#2c7bb6"]);

    return function(d, i) { return scale(d.idi); };
  };

  HeatMapPlot.prototype.getPairs = function(d, i) {
    var getPairs = this.getPairs();
    if (d.__row < d.__column) {
      return this.range(getPairs(d, i));
    }
    return getPairs(d, i);
  };

  HeatMapPlot.prototype.mark = function(pairs) {
    var cellSize = this.cellSize(),
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

  HeatMapPlot.prototype.show = function(sequences) {
    var map = {},
        getFirst = this.pairs.getFirst();
    $.each(sequences, function(_, s) { map[s] = true; });

    var pairs = $.map(this.ordered(), function(data, _) {
      if (data.__row === data.__column && map[getFirst(data)]) {
        return data;
      }
      return null;
    });
    this.mark(pairs);
  };

  HeatMapPlot.prototype.range = function(pair) {
    var ordered = this.ordered(),
        showable = false,
        seen = {},
        getFirst = this.pairs.getFirst();

    $.each(ordered, function(_, obj) {
      var first = getFirst(obj);
      if (first === pair[0]) {
        showable = true;
      }
      if (showable) {
        seen[first] = true;
      }
      if (first === pair[1]) {
        showable = false;
      }
    });
    return $.map(seen, function(_, sequence) { return sequence; });
  };

  HeatMap.items = accessor({});
  HeatMap.pairs = accessor([]);
  HeatMap.pairs.getItems = accessor(function(d, i) { return d.items; });
  HeatMap.pairs.getFirst = accessor(function(d, i) { return d.items[0]; });
  HeatMap.pairs.getSecond = accessor(function(d, i) { return d.items[1]; });

  var HeatMap = window.HeatMap || function(config) {

    var plot = new HeatMapPlot();

    $.each(HeatMap, function(name, fn) {
      plot[name] = fn.bind(plot);
    });

    var defaults = {
      margin: 30,
      size:  550,
      selection: null,
      ordered: [],
      getPairs: function(d) { return [d.item1, d.item2]; },
      fillBuilder: plot.colorScaleBuilder,
      click: Object,
      addDefinitions: Object
    };

    var conf = $.extend({}, defaults, config);
    $.each(defaults, function(key, value) {
      plot[key] = accessor(conf[key]);
    });

    return function() {
      var margin = plot.margin(),
          selection = d3.select(plot.selection());

      selection.select('svg').remove();

      var top = selection.append('svg')
        .attr('width', plot.size() + margin * 2)
        .attr('height', plot.size() + margin * 2);

      plot.addDefinitions()(top.append('svg:defs'));

      plot.vis = top.append("g")
        .attr("transform", 
            "translate(" + margin + "," + margin + ")");

      plot.draw();

    };
  };

  window.HeatMap = HeatMap;

}());
