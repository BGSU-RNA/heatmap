/* jshint jquery: true, browser: true, devel: true */
$(document).ready(function() {
  'use strict';
  /* global HeatMap, d3, Handlebars, jsMolTools */

  var itemData = {},
      currentData = [],
      summaryAttributeRanges = {},
      rawUrl = 'static/img/{{family}}/{{family}}_{{sequence}}_exemplar.png',
      exemplarUrlTemplate = Handlebars.compile(rawUrl),
      heatMapTemplate = null,
      summaryTemplate = null,
      missingTemplate = null,
      exemplarHoverTemplate = null,
      heatMap = new HeatMap({size: 300, selection: '#heat-map'}),
      summary = new HeatMap({size: 550, selection: '#summary-table'});

  $.get('static/templates/heat-map-template.hbs', function(string) {
    heatMapTemplate = Handlebars.compile(string);
  });

  $.get('static/templates/exemplar-hover.hbs', function(string) {
    summaryTemplate = Handlebars.compile(string);
  });

  $.get('static/templates/exemplar-legend-hover.hbs', function(string) {
    exemplarHoverTemplate = Handlebars.compile(string);
  });

  $.get('static/templates/exemplar-missing-hover.hbs', function(string) {
    missingTemplate = Handlebars.compile(string);
  });


  function generateLegend(range, func) {
    var last = range[1] - range[2];
    return d3.range.apply(null, range).map(function(value) {
      return func(value, (last - value < 0.0001));
    });
  }

  function showSelected(data) {

    // Exclude things where we do not have 3D coordinates
    var known = data.filter(function(d) { return d.coordinates_exist; });

    // Do nothing if we have selected something that has no 3D
    if (known.length === 0) { return; }

    var patterns = known.map(function(d) {
          return new RegExp(d.sequence, "i");
        }),
        rowIds = [],
        cellIds = [];

    heatMap.ordered().forEach(function(data) {
      patterns.forEach(function (pattern) {
        if (pattern.test(data.items[0]) && pattern.test(data.items[1]) &&
           data.__row === data.__column) {
          cellIds.push(data.id);
          rowIds.push(data.id.split('-').splice(0, 2).join('-'));
        }
      });
    });

    heatMap.active
      .data(cellIds)
      .draw();

    summary.active
      .data(known.map(function(e) { return e.id.toUpperCase(); }))
      .draw();

    jsMolTools.showOnly(known.map(function(e) {
      return { id: e.id, unit_ids: e.units.join(',') };
    }));

    $('.jmol-toggle').removeClass('success');
    rowIds.forEach(function(id) { $('#' + id).addClass('success'); });
  }

  function clearDisplay() {
    currentData = [];
    heatMap.active.clear();
    summary.active.clear();
    jsMolTools.showOnly([]);
    $('.jmol-toggle').removeClass('success');
  }

  function handleClick(event, items) {
    if (event.ctrlKey || event.metaKey) {
      var seen = {};
      items.forEach(function(item) { seen[item.id] = item; });

      currentData = currentData.filter(function(d) {
        if (seen[d.id]) {
          delete seen[d.id];
          return false;
        }
        return true;
      });

      Object.keys(seen).forEach(function(k) { currentData.push(seen[k]); });
    } else {
      currentData = items;
    }

    if (!currentData.length) {
      clearDisplay();
    } else {
      showSelected(currentData);
    }
  }

  function jmolWatch() {
    $('.jmol-toggle').on('click', function(event) {
      var data = [itemData[$(this).data('sequence')]];
      handleClick(event, data);
    });
  }

  function mapClick(pairs) {
    var data = pairs.map(function(entry) { return itemData[entry]; });
    handleClick(d3.event, data);
  }

  function updateTable(name, raw) {
    var order = {},
        nts = [];

    Object.keys(raw.items).forEach(function(key) {
      var data = $.extend({}, raw.items[key]);
      data['class'] = (!data.coordinates_exist ? 'no-hover' : '');
      data.icon = 'fa-' + (data.coordinates_exist ? 'check' : 'warning');
      data.resolution = data.resolution || 'NA';

      var selector = data.units.join(', ');
      if (!data.units.length ||
          (data.units[0] === "" && data.units[1] === "")) {
        selector = '';
      }
      data.nts = selector;

      nts.push(data);
    });

    nts = nts.filter(function(d) { return d.units.length; });

    $.each(raw.pairs, function(index, pair) {
      var key = pair.items[0];
      order[key] = order[key] || index;
    });

    nts
      .sort(function(a, b) { return order[a.sequence] - order[b.sequence]; }).
      filter(function(d) { return raw.items[d.id]; });

    $("#table-container")
      .empty()
      .handlebars("pairs-table", {items: nts}, jmolWatch);
  }

  function summarizeRange(domain, inc, attr, labelText) {
    var lengendRange = domain.slice(0),
        max = d3.max(domain),
        scale = d3.scale.linear()
          .domain(domain)
          // .range(["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7",
          //        "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac",
          //        "#053061"])
          .range(["#2166ac", "#b2182b"])
          .interpolate(d3.interpolateRgb);
          // ;

    lengendRange.push(inc);
    var legend = generateLegend(lengendRange, function(value, isLast) {
      var label = labelText + (isLast ? '>' + value : value),
          data = {exists: true, value: value, label: label};
      data[attr] = value;
      return data;
    });

    if (inc < 0) {
      legend.reverse();
    }

    summary.legend.data(legend);

    summary.cells
      .fill(function(d) {
        return (d.exists ? scale(Math.min(d[attr], max)) : 'white');
      });

    summary.legend
      .fill(function(d) { return scale(d.value); });
  }

  function updateSummary() {
    var name = $("#coloring-selector").val();

    if (name === 'exemplar') {
      summary.legend.data(null);
      summary.cells.fill(function(d) {
        return (d.exists ? 'url(#' + d.name + ')' : 'white');
      })
      .attr('stroke', 'black')
      .attr('stroke-opacity', 0.2);

    } else {
      summary.cells
        .attr('stroke-opacity', 1)
        .attr('stroke', 'white');

      if (name === 'count') {
        var countMax = d3.min([summaryAttributeRanges.count[1], 400]);
        summarizeRange([0, countMax], 1, 'count', 'Count: ');

      } else if (name === 'resolution') {
        summarizeRange([4, 0], -0.01, 'resolution', 'Resolution: ');
      }
    }

    var missing = summary.data().filter(function(d) {
      return !d.exists;
    }).map(function(d) { return d.id.toUpperCase(); });

    summary.missing.data(missing);
    summary.draw();

    $("#summary-table .legend-cell").tipsy({
      gravity: 's',
      html: true,
      title: function() { return exemplarHoverTemplate(this.__data__); }
    });

    $("#summary-table .cell").tipsy({
      gravity: 's',
      html: true,
      // TODO: Fix computing the offset
      // offset: function(element) {
      //   var bbox = this.getBoundingClientRect();
      //   console.log(bbox);
      //   console.log('offset', $(this).offset());
      //   return [bbox.left + bbox.width/2, 10 * bbox.top];
      // },
      title: function() {
        var data = this.__data__,
            resolution = data.resolution || 'NA',
            context = $.extend({}, data, {resolution: resolution});
        if (data.exists) {
          return summaryTemplate(context);
        }
        return missingTemplate(context);
      }
    });
  }

  function aggregateItems(family, known, items) {

    var nts = ['A', 'C', 'G', 'U'],
        data = [],
        knownValues = function(sequence, name) {
          return $.map(known[sequence], function(combination) {
            return items[combination][name];
          });
        };

    nts.forEach(function(first) {
      nts.forEach(function(second) {
        var sequence = first + second,
            entry = {
              id: family.toUpperCase() + '-' + sequence.toUpperCase(),
              sequence: sequence,
              items: [first, second],
              count: 0,
              distance: false,
              resolution: false,
              exists: known.hasOwnProperty(sequence),
              image: 'white'
            };

        if (entry.exists) {
          entry.url = exemplarUrlTemplate({family: family, sequence: sequence});
          entry.name = family + '-' + sequence + '-basepair';
          entry.count = d3.sum(knownValues(sequence, 'count'));
          entry.distance = d3.median(knownValues(sequence, 'distance'));

          // Have to deal with modeled things which have no resolution.
          // This isn't the most elegant but it works.
          entry.resolution = d3.median(knownValues(sequence, 'resolution'));
          entry.resolution = entry.resolution || null;
        }

        data.push(entry);
      });
    });

    return data;
  }

  function generateDefs(data) {
    var defs = $.map(data, function(entry) {
      return (entry.exists ?  {name: entry.name, url: entry.url} : null);
    });

    return function(svg) {
      var cellSize = this.cellSize();
      defs.forEach(function(def) {
        svg.append('svg:pattern')
          .attr('id', def.name)
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('patternUnits', 'userSpaceOnUse')
          .append('svg:image')
            .attr('xlink:href', def.url)
            .attr('width', cellSize)
            .attr('height', cellSize);
      });
    };
  }

  function summarizeItems(items) {
    var ranges = {count: [], resolution: []};
    $.each(items, function(_, item) {
      ranges.count.push(item.count);
      ranges.resolution.push(item.resolution);
    });
    ranges.count = [0, d3.max(ranges.count)];
    ranges.resolution = [0, d3.max(ranges.resolution)];
    return ranges;
  }

  function setUpSummary(family, items) {
    var known = heatMap.known(),
        data = aggregateItems(family, known, items),
        defFn = generateDefs(data);

    summaryAttributeRanges = summarizeItems(items);
    summary.addDefinitions(defFn);
    summary.data(data);
    updateSummary();
  }

  function loadFamily(name) {
    var url = 'static/data/' + name + '.json';

    currentData = [];

    $.get(url, function(data) {
      if (typeof data === "string") {
        data = $.parseJSON(data);
      }
      itemData = data.items;
      updateTable(name, data);

      heatMap.missing
        .data(data.pairs
              .filter(function(d) { return !d.exists; })
              .map(function(d) { return d.id; }));

      heatMap
        .data(data.pairs)
        .draw();

      $("#heat-map .cell").tipsy({
        gravity: 's',
        html: true,
        title: function() {
          var data = $.extend({}, this.__data__);
          data.sequence = data.items.join(' ');
          data.idi = data.idi.toFixed(2);
          return heatMapTemplate(data);
        }
      });

      $("#heat-map .legend-cell").tipsy({
        gravity: 's',
        html: true,
        title: function() {
          var data = $.extend({}, this.__data__);
          data.sequence = '';
          data.idi = data.idi.toFixed(2);
          return heatMapTemplate(data);
        }
      });

      setUpSummary(name, data.items);
    });
  }

  heatMap.active
    .attr('fill', '#31a354');

  heatMap.missing
    .attr('fill', '#fd8d3c')
    .attr('opacity', 1)
    .type('triangle-up')
    .fraction(0.3)
    .rotation(false);

  summary.labels.column
      .rotate(false);

  summary.missing
    .fraction(0.1);

  summary.active
    .attr('fill-opacity', 0)
    .attr('stroke', 'black')
    .attr('stroke-width', 2);

  heatMap.cells
    .click(function(d, i) {
      var pairs = heatMap.getPairsInRange(d, i);
      mapClick(pairs.map(function(d) { return d.items[0]; }));
    })
    .fill(heatMap.cells.idiFill());

  summary.cells.click(function(d) {
    var known = heatMap.known();
    mapClick(known[d.sequence]);
  });

  heatMap.legend.data(generateLegend([0, 6, 0.1], function(idi, isLast) {
    var label = 'IDI: ' + (isLast ? '>' + idi : idi);
    return {value: idi, idi: idi, label: label, exists: true};
  }));

  $('.chosen-select').chosen();
  $('#family-selector').change(function() {
    var name = $(this).val();
    currentData = [];
    jsMolTools.showOnly([]);
    loadFamily(name);
  });
  $('#coloring-selector').change(updateSummary);

  $('#jt-clear').on('click', clearDisplay);

  $("#jt-numbers").on('click', function() {
    jsMolTools.toggleNumbers();
    $(this).button('toggle');
  });

  loadFamily($("#family-selector").val());

});
