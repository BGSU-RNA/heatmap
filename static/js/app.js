/*global document, HeatMap, d3, $ */
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

      var fn = function(d, i) { 
        var value = d[attr];
        if (!d.exists) {
          return missingGrey;
        }
        if (value > max) {
          return scale(max);
        }
        return scale(value);
      };

      summary
        .legend(legend)
        .fill(fn);
  }

  function updateSummary() {
    var name = $("#coloring-selector").val();

    if (name === 'exemplar') {
      summary.legend(null);
      summary.fill(function(d, i) { return d.image; });

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
        var data = this.__data__;
        return '<p><span>Count: ' + data.count + '</span></p>' +
          '<p><span>Resolution: ' + data.resolution + '</span></p>'
      ;
      }
    });
  }

  function setUpSummary(family) {
    var fillFn = Object,
        known = heatMap.known(),
        nts = ["A", "C", "G", "U"],
        data = [],
        defs = [],
        cellSize = summary.cellSize(4);

    var knownValues = function(sequence, name) {
      if (!known[sequence]) {
        return [0];
      }
      return $.map(known[sequence], function(combination, _) {
        return itemData[combination][name];
      });
    };

    summaryAttributeRanges = {
      count: [],
      distance: []
    };

    $.each(nts, function(_, first) {
      $.each(nts, function(_, second) {
        var sequence = first + second,
            imageFill = missingGrey,
            count = d3.sum(knownValues(sequence, 'count')),
            distance = d3.median(knownValues(sequence, 'distance'));

        if (known.hasOwnProperty(sequence)) {
          var url = 'static/img/' + family + '/' + family + ' _' + sequence + '_exemplar.png',
              fillName = family + '-' + sequence + '-basepair';
          imageFill = 'url(#' + fillName + ')';
          defs.push({name: fillName, url: url});
        }

        summaryAttributeRanges.count.push(count);
        summaryAttributeRanges.distance.push(distance);

        data.push({
          'sequence': sequence,
          'items': [first, second],
          'count': count,
          'resolution': d3.median(knownValues(sequence, 'resolution')),
          'distance': distance,
          'image': imageFill,
          'exists': known.hasOwnProperty(sequence),
        });
      });
    });

    summaryAttributeRanges.count = d3.extent(summaryAttributeRanges.count);
    summaryAttributeRanges.distance = d3.extent(summaryAttributeRanges.distance);

    summary.pairs(data);

    summary.addDefinitions(function(svg) {
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
    });

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

      setUpSummary(name);
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

  summary.click(function(d, i) {
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
