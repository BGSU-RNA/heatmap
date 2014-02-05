/*global document, HeatMap, d3, $, Handlebars */
$(document).ready(function() {

  var itemData = {},
      totalRows = [],
      summaryAttributeRanges = {},
      missingGrey = 'grey',
      heatMap = HeatMap({ size: 300, selection: '#heat-map' }),
      summary = HeatMap({ size: 300, selection: '#summary-table', rotateColumns: false });

  function generateLegend(range, func) {
    var last = range[1] - range[2];
    return $.map(d3.range.apply(null, range), function(value, _) {
      return func(value, (last - value < 0.0001));
    });
  }

  function jmolWatch() {
    $('.jmol-toggle').jmolTools({
      showStereoId: 'jt-stereo',
      showNumbersId: 'jt-numbers',
      showNextId: 'jt-next',
      showPrevId: 'jt-prev',
      showAllId: 'jt-all'
    });

    $('.jmol-toggle').on('click', function(event) {
      var $this = $(this);
      if ($this.hasClass('success')) {
        $this.removeClass('success');
      } else {
        if (event.ctrlKey || event.metaKey) {
          totalRows.push($this.data('sequence'));
          $(this).addClass('success');
        } else {
          totalRows = [$this.data('sequence')];
          $('.jmol-toggle').removeClass('success');
          $(this).addClass('success');
        }
        heatMap.show(totalRows);
      }
    });
  }

  function toggleRows(rows) {
    $('.jmol-toggle').removeClass('success');
    $('.jmol-toggle').jmolHide();
    $.each(rows, function(_, sequence) {
      var id = 'row-' + sequence;
      $("#" + id).addClass('success');
      $.jmolTools.models[id].show();
    });
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
            count: data.count
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
      summary.fill(function(d, _) { return 'url(#' + d.name + ')'; });

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

  function summarizeItems(family, known, items) {

    var nts = ['A', 'C', 'G', 'U'],
        data = [],
        knownValues = function(sequence, name) {
          return $.map(known[sequence], function(combination, _) {
            return items[combination][name];
          });
        };

    $.each(nts, function(_, first) {
      $.each(nts, function(_, second) {
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
          var url = 'static/img/' + family + '/' + family + ' _' + sequence + '_exemplar.png',
              fillName = family + '-' + sequence + '-basepair';
          entry.url = url;
          entry.name = fillName;
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

  function setUpSummary(family, items) {
    var known = heatMap.known(),
        data = summarizeItems(family, known, items),
        defFn = generateDefs(data);

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

  function mapClick(rows) {
    if (d3.event.ctrlKey || d3.event.metaKey) {
      totalRows = totalRows.concat(rows);
    } else {
      totalRows = rows;
    }
    toggleRows(totalRows);
    heatMap.show(totalRows);
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
    return {'value': idi, 'idi': idi, 'label': label};
  }));

  $('.chosen-select').chosen();
  $('#family-selector').change(loadFamily);
  $('#coloring-selector').change(updateSummary);
  loadFamily();

});
