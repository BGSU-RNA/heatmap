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
        if (event.shiftKey) {
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

  function updateSummary(name, raw) {
    var nts = ["A", "C", "G", "U"],
        data = {items: {}, pairs: []},
        cellSize = summary.cellSize(4),
        defs = [],
        known = {};
    
    $.each(raw.items, function(key, _) { known[key.toUpperCase()] = true; });

    $.each(nts, function(_, first) {
      $.each(nts, function(_, second) {
        var sequence = first + second;
        if (known.hasOwnProperty(sequence)) {
          var url = 'static/img/' + name + '/' + name + ' _' + sequence + '_exemplar.png',
              fillName = name + '-' + sequence + '-basepair';

          defs.push({name: fillName, url: url});
          data.items[sequence] = {'url': fillName};
          data.pairs.push({
            'item1': first, 
            'item2': second, 
            'fill': 'url(#' + fillName + ')'
              });
        } else {
          data.items[sequence] = {'url': false};
          data.pairs.push({
            'item1': first, 
            'item2': second, 
            'fill': 'rgb(242, 222, 222)'
            });
        }
      });
    });

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

    summary(data);
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
        });

    $("#table-container")
      .empty()
      .handlebars("pairs-table", {family: name, nts: nts}, jmolWatch);
  }

  function loadFamily() {
    var name = $("#family-selector").val(),
        url = 'static/data/' + name + '.json';
    $.get(url, function(data) {
      if (typeof data === "string") {
        data = $.parseJSON(data);
      }
      updateTable(name, data);
      heatMap(data);
      updateSummary(name, data);
    });
  }

  heatMap.click(function(d, i) {
    var rows = heatMap.getPairs()(d, i);
    if (d3.event.shiftKey) {
      totalRows = totalRows.concat(rows);
    } else {
      totalRows = rows;
    }
    toggleRows(totalRows);
    heatMap.show(totalRows);
  });

  summary.fillBuilder(function() {
    return function(d, i) { return d.fill; };
  });

  $('.chosen-select').chosen();
  $('#family-selector').change(loadFamily);
  loadFamily();

});
