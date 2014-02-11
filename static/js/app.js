/*global document, HeatMap, d3, $, Handlebars, jsMolTools */
$(document).ready(function() {

  var itemData = {},
      currentData = [],
      summaryAttributeRanges = {},
      missingGrey = 'grey',
      exemplarUrlTemplate = Handlebars.compile('static/img/{{family}}/{{family}} _{{sequence}}_exemplar.png'),
      heatMap = HeatMap({ size: 300, selection: '#heat-map' }),
      summary = HeatMap({ size: 300, selection: '#summary-table', rotateColumns: false, onlyDiagonal: false });

  summary.markOpacity(0.4);

  heatMap.fill(function(d) {
    var getFirst = heatMap.getFirstItem(),
        scale = heatMap.colorScale();
    if (d.__row !== d.__column) {
      return scale(d);
    }
    if (d.label || itemData[getFirst(d)].coordinates_exist) {
      return scale(d);
    }
    return missingGrey;
  });

  function generateLegend(range, func) {
    var last = range[1] - range[2];
    return $.map(d3.range.apply(null, range), function(value, _) {
      return func(value, (last - value < 0.0001));
    });
  }

  function showSelected(data) {

    // Exclude things where we do not have 3D coordinates
    var known = data.filter(function(d) { return d.coordinates_exist; });

    heatMap.show(known.map(function(e) { return e.sequence; }));
    // summary.show(known);

    jsMolTools.showOnly(known.map(function(entry) {
      return {
        id: entry.family + '-' + entry.sequence,
        unit_ids: entry.units.join(','),
      };
    }));
  }

  function jmolWatch() {
    $('.jmol-toggle').on('click', function(event) {
      var $this = $(this),
          data = itemData[$this.data('sequence')];

      if ($this.hasClass('success')) {
        $this.removeClass('success');
      } else {
        if (event.ctrlKey || event.metaKey) {
          currentData.push(data);
          $this.addClass('success');
        } else {
          currentData = [data];
          $('.jmol-toggle').removeClass('success');
          $this.addClass('success');
        }
      }

      showSelected(currentData);
    });
  }

  function mapClick(pairs) {
    var data = pairs.map(function(entry) { return itemData[entry]; });
    if (d3.event.ctrlKey || d3.event.metaKey) {
      currentData = currentData.concat(data);
    } else {
      currentData = data;
    }

    showSelected(currentData);
  }

  // function toggleRows(rows) {
  //   $('.jmol-toggle').removeClass('success');
  //   $('.jmol-toggle').jmolHide();
  //   $.each(rows, function(_, sequence) {
  //     var id = 'row-' + sequence;
  //     $("#" + id).addClass('success');
  //     $.jmolTools.models[id].show();
  //   });
  // }

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

    summary
      .legend(legend)
      .fill(function(d, _) {
        if (!d.exists || d[attr] === null) {
          return missingGrey;
        }
        return scale(Math.min(d[attr], max));
      });
  }

  function updateSummary() {
    var name = $("#coloring-selector").val(),
        template = null;

    // This should be done before hovering. I hope.
    $.get('static/templates/exemplar-hover.hbs', function(string) {
      template = Handlebars.compile(string);
    });

    if (name === 'exemplar') {
      summary.legend(null);
      summary.fill(function(d, _) {
        return (d.exists ? 'url(#' + d.name + ')' : missingGrey);
      });

    } else if (name === 'count') {
      var countMax = d3.min([summaryAttributeRanges.count[1], 400]);
      summarizeRange([0, countMax], 1, 'count', 'Count: ');

    } else if (name === 'resolution') {
      summarizeRange([4, 0], -0.01, 'resolution', 'Resolution: ');
    }

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
        return template(context);
      }
    });
  }

  function aggregateItems(family, known, items) {

    var nts = ['A', 'C', 'G', 'U'],
        data = [],
        knownValues = function(sequence, name) {
          return $.map(known[sequence], function(combination, _) {
            return items[combination][name];
          });
        };

    nts.forEach(function(first) {
      nts.forEach(function(second) {
        var sequence = first + second,
            entry = {
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
    var defs = $.map(data, function(entry, _) {
      return (entry.exists ?  {name: entry.name, url: entry.url} : null);
    });

    return function(svg) {
      var cellSize = this.cellSize();
      $.each(defs, function(_, def) {
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
    summary.pairs(data);
    updateSummary();
  }


  function loadFamily() {
    var name = $("#family-selector").val(),
        url = 'static/data/' + name + '.json';
    $.get(url, function(data) {
      if (typeof data === "string") {
        data = $.parseJSON(data);
      }
      itemData = data.items;
      updateTable(name, data);
      heatMap
        .pairs(data.pairs)
        .draw();

      $("#heat-map .cell").tipsy({
        gravity: 's',
        html: true,
        title: function() {
          var data = this.__data__;
          return '<span>' + data.items.join(' ') + ': ' + data.idi.toFixed(2) + '</span>';
        }
      });

      setUpSummary(name, data.items);
    });
  }

  heatMap.click(function(d, i) {
    mapClick(heatMap.getPairsInRange(d, i));
  });

  summary.click(function(d, _) {
    var known = heatMap.known();
    mapClick(known[d.sequence]);
  });

  heatMap.legend(generateLegend([0, 6, 0.1], function(idi, isLast) {
    var label = 'IDI: ' + (isLast ? '>' + idi : idi);
    return {value: idi, idi: idi, label: label};
  }));

  $('.chosen-select').chosen();
  $('#family-selector').change(loadFamily);
  $('#coloring-selector').change(updateSummary);
  // $('#jt-numbers').jsMolTools.numberToggle();
  // $('#jt-clear').jsMolTools.clearToggle();
  loadFamily();

});
