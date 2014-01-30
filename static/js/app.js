/*global document, HeatMap, d3, $ */
$(document).ready(function() {

  var totalRows = [],
      heatMap = HeatMap({ selection: '#heat-map' });

  var jmolWatch = function() {
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
  };

  var toggleRows = function(rows) {
    $('.jmol-toggle').removeClass('success');
    $('.jmol-toggle').jmolHide();
    $.each(rows, function(_, sequence) {
      var id = 'row-' + sequence;
      $("#" + id).addClass('success');
      $.jmolTools.models[id].show();
    });
  };

  heatMap.click(function(d, i) {
    var rows = heatMap.getPairs(d, i);
    if (d3.event.shiftKey) {
      totalRows = totalRows.concat(rows);
    } else {
      totalRows = rows;
    }
    toggleRows(totalRows);
    heatMap.show(totalRows);
  });

  var updateTable = function(name, raw) {
    var seen = {},
        nts = $.map(raw.nts, function(nts, sequence) {
          return {
            group: raw.groups[sequence],
            sequence: sequence,
            nt1: nts[0],
            nt2: nts[1]
          };
        }),
        context = {family: name, nts: nts},
        summary = {groups: 0, combinations: nts.length};

    $.each(raw.groups, function(_, group) {
      if (!seen[group]) {
        summary.groups += 1;
        seen[group] = true;
      }
    });

    $("#table-container")
      .empty()
      .handlebars("pairs-table", context, jmolWatch);

    $("#summary")
      .empty()
      .handlebars('summary-template', summary, Object);
  };

  var loadFamily = function() {
    var name = $("#family-selector").val(),
        url = 'static/data/' + name + '.json';
    $.get(url, function(data) {
      if (typeof data === "string") {
        data = $.parseJSON(data);
      }
      updateTable(name, data);
      heatMap(data);
    });
  };

  $('.chosen-select').chosen();
  $('#family-selector').change(loadFamily);
  loadFamily();

});
