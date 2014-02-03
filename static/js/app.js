/*global document, HeatMap, d3, $ */
$(document).ready(function() {

  var totalRows = [],
      heatMap = HeatMap({ size: 300, selection: '#heat-map' }),
      summary = HeatMap({ size: 300, selection: '#summary-table' });

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

  function updateSummary() {
    var name = $("#coloring-selector").val(),
        fn = Object;
    
    if (name === 'exemplar') {
      fn = function(d, i) { return d.image; };
    }

    summary.fill(fn);
  }

  function setUpSummary(family) {
    var fillFn = Object,
        known = heatMap.known(),
        nts = ["A", "C", "G", "U"],
        data = [],
        defs = [],
        cellSize = summary.cellSize(4);

    $.each(nts, function(_, first) {
      $.each(nts, function(_, second) {
        var sequence = first + second,
            imageFill = 'rgb(242, 222, 222)',
            count = 0,
            resolution = 0,
            distance = 0;
        if (known.hasOwnProperty(sequence)) {
          var url = 'static/img/' + family + '/' + family + ' _' + sequence + '_exemplar.png',
              fillName = family + '-' + sequence + '-basepair';
          imageFill = 'url(#' + fillName + ')';
          defs.push({name: fillName, url: url});
        }
        data.push({
          'sequence': sequence,
          'items': [first, second], 
          'count': count,
          'resolution': resolution,
          'distance': distance,
          'image': imageFill
        });
      });
    });

    updateSummary();

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

    summary
      .pairs(data)
      .draw();
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

  $('.chosen-select').chosen();
  $('#family-selector').change(loadFamily);
  $('#coloring-selector').change(updateSummary);
  loadFamily();

});
