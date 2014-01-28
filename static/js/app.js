/*global document, HeatMap, d3, $ */
$(document).ready(function() {

  var heatMap = HeatMap({ selection: '#heat-map' });

  var jmolWatch = function() {
    $('.jmol-toggle').jmolTools({
      showStereoId: 'jt-stereo',
      showNumbersId: 'jt-numbers',
      showNextId: 'jt-next',
      showPrevId: 'jt-prev',
      showAllId: 'jt-all'
    });

    $('.jmol-toggle').on('click', function() {
      var $this = $(this);
      if ($this.hasClass('success')) {
        $this.removeClass('success');
        heatMap.unmark($this.data('unit-ids').split(','));
      } else {
        $(this).addClass('success');
        heatMap.mark($this.data('unit-ids').split(','));
      }
    });
  };

  var toggleRows = function(rows) {
    $('.jmol-toggle').removeClass('success');
    $('.jmol-toggle').jmolHide();
    $.each(rows, function(_, sequence) {
      console.log(sequence);
      $("#row-" + sequence)
        .addClass('success')
        .jmolShowOne();
    });
  };

  heatMap.click(function(d, i) {
    var rows = heatMap.getPairs(d, i);
    toggleRows(rows);
    heatMap.show(rows);
  });

  var updateTable = function(name, raw) {
    var nts = $.map(raw.nts, function(nts, sequence) {
      return {group: '', sequence: sequence, nt1: nts[0], nt2: nts[1]};
    });
    var context = {family: name, nts: nts};

    $("#table-container").handlebars("pairs-table", context, jmolWatch);
  };

  var loadFamily = function(name) {
    var url = 'static/data/' + name + '.json';
    $.get(url, function(raw) {
      var data = $.parseJSON(raw);
      updateTable(name, data);
      heatMap(data);
    });

  };

  loadFamily('tHH');
  $('.chosen-select').chosen();

});
