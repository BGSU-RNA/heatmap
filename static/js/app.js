$(document).ready(function() {
  'use strict';
  /* jshint jquery: true, browser: true */
  /* global document, HeatMap, d3, Handlebars, jsMolTools, console */

  var itemData = {},
      currentData = [],
      summaryAttributeRanges = {},
      missingGrey = 'white',
      rawUrl = 'static/img/{{family}}/{{family}}_{{sequence}}_exemplar.png',
      exemplarUrlTemplate = Handlebars.compile(rawUrl),
      heatMapTemplate = null,
      summaryTemplate = null,
      heatMap = new HeatMap({size: 300, selection: '#heat-map'}),
      summary = new HeatMap({size: 300, selection: '#summary-table'});

  summary.labels.column.rotate(false);

  $.get('static/templates/heat-map-template.hbs', function(string) {
    heatMapTemplate = Handlebars.compile(string);
  });

  $.get('static/templates/exemplar-hover.hbs', function(string) {
    summaryTemplate = Handlebars.compile(string);
  });

  heatMap.cells.fill(function(d) {
    var getFirst = heatMap.cells.getFirstItem(),
        scale = heatMap.cells.idiFill();
    if (d.__row !== d.__column) {
      return scale(d);
    }
    if (d.label || itemData[getFirst(d)].coordinates_exist) {
      return scale(d);
    }
    return missingGrey;
  });

  summary.active
    .onlyDiagonal(false)
    .attr('fill-opacity', 0)
    .attr('stroke', 'black')
    .attr('stroke-width', 2);

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

    heatMap.active
      .data(known.map(function(e) { return e.sequence; }))
      .draw();

    summary.active
      .data(known.map(function(e) { return e.id.toUpperCase(); }))
      .draw();

    jsMolTools.showOnly(known.map(function(e) {
      return { id: e.id, unit_ids: e.units.join(',') };
    }));

    $('.jmol-toggle').removeClass('success');
    data.forEach(function(datum) {
      $('#row-' + datum.sequence).addClass('success');
    });
  }

  function handleClick(event, items) {
    if (event.ctrlKey || event.metaKey) {
      items.forEach(function(item) {
        var index = currentData.indexOf(item);
        if (index === -1) {
          currentData.push(item);
        } else {
          currentData.splice(index, 1);
        }
      });
    } else {
      currentData = items;
    }

    showSelected(currentData);
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
    var nts = $.map(raw.items, function(data, sequence) {
          return {
            group: data.group,
            sequence: sequence,
            pdb: data.pdb,
            resolution: data.resolution,
            nt1: data.units[0],
            nt2: data.units[1],
            count: data.count,
            'class': (data.coordinates_exist ? '' : 'warning')
          };
        }),
        order = {};

    $.each(raw.pairs, function(index, pair) {
      var key = pair.items[0];
      order[key] = order[key] || index;
    });

    nts.sort(function(a, b) { return order[a.sequence] - order[b.sequence]; });

    $("#table-container")
      .empty()
      .handlebars("pairs-table", {family: name, nts: nts}, jmolWatch);
  }

  function summarizeRange(domain, inc, attr, labelText) {
    var lengendRange = domain.slice(0),
        max = d3.max(domain),
        scale = d3.scale.linear()
          .domain(domain)
          .range(["#2166ac", "#b2182b"])
          .interpolate(d3.interpolateRgb);

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
        if (!d.exists || d[attr] === null) {
          return missingGrey;
        }
        return scale(Math.min(d[attr], max));
      });
  }

  function updateSummary() {
    var name = $("#coloring-selector").val();

    if (name === 'exemplar') {
      summary.legend.data(null);
      summary.cells.fill(function(d) {
        return (d.exists ? 'url(#' + d.name + ')' : 'white');
      });

    } else if (name === 'count') {
      var countMax = d3.min([summaryAttributeRanges.count[1], 400]);
      summarizeRange([0, countMax], 1, 'count', 'Count: ');

    } else if (name === 'resolution') {
      summarizeRange([4, 0], -0.01, 'resolution', 'Resolution: ');
    }

    var missing = summary.data().filter(function(d) {
      return !d.exists;
    }).map(function(d) { return d.id.toUpperCase(); });

    summary.missing.data(missing);
    summary.draw();

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
        return summaryTemplate(context);
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
              image: missingGrey
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
    summaryAttributeRanges = {count: [], resolution: []};
    $.each(items, function(_, item) {
      summaryAttributeRanges.count.push(item.count);
      summaryAttributeRanges.resolution.push(item.resolution);
    });
    summaryAttributeRanges.count = [0, d3.max(summaryAttributeRanges.count)];
    summaryAttributeRanges.resolution = [0, d3.max(summaryAttributeRanges.resolution)];
  }

  function setUpSummary(family, items) {
    var known = heatMap.known(),
        data = aggregateItems(family, known, items),
        defFn = generateDefs(data);

    summarizeItems(items);
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

      setUpSummary(name, data.items);
    });
  }

  heatMap.cells.click(function(d, i) {
    var pairs = heatMap.getPairsInRange(d, i);
    mapClick(pairs.map(function(d) { return d.items[0]; }));
  });

  summary.cells.click(function(d) {
    var known = heatMap.known();
    mapClick(known[d.sequence]);
  });

  heatMap.legend.data(generateLegend([0, 6, 0.1], function(idi, isLast) {
    var label = 'IDI: ' + (isLast ? '>' + idi : idi);
    return {value: idi, idi: idi, label: label};
  }));

  $('.chosen-select').chosen();
  $('#family-selector').change(function() {
    var name = $(this).val();
    currentData = [];
    jsMolTools.showOnly([]);
    loadFamily(name);
  });
  $('#coloring-selector').change(updateSummary);

  $('#jt-clear').on('click', function() {
    currentData = [];
    heatMap.active.clear();
    summary.active.clear();
    $('.jmol-toggle').removeClass('success');
  });

  $("#jt-numbers").on('click', function() {
    jsMolTools.toggleNumbers();
    $(this).button('toggle');
  });

  loadFamily($("#family-selector").val());

});
