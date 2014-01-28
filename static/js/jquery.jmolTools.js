// Utility
if ( typeof Object.create !== 'function' ) {
  Object.create = function( obj ) {
    function F() {}
    F.prototype = obj;
    return new F();
  };
}

(function($) {
  'use strict';
  /*global jmolScript, jmolScriptWait, document, window, jQuery */
  var cache = {};

  // an object for keeping track of the whole system
  $.jmolTools = {
    neighborhood : false,
    stereo: false,
    models : {}, // all model objects, both loaded and not
    numModels: 0 // number of loaded models
  };

  // an object for keeping track of each individual model's state
  var jmolModel = {

    init: function (options, elem) {
      var self = this;
      self.elem = elem;
      self.$elem = $( elem );
      self.modelNumber  = null;
      self.loaded       = false;
      self.neighborhood = false;
      self.superimposed = false;
      self.styled       = false;
      self.checked      = false;
      self.hidden       = false;
      self.bindEvents();
    },

    bindEvents: function() {
      this.$elem.on('click', this.jmolToggle);
    },

    loadData: function() {

      var self = this,
          ids = self.$elem.data($.fn.jmolTools.options.dataAttribute);

      if ( self.loaded ) { return; }

      console.log('ids', ids);

      $.ajax({
        url: $.fn.jmolTools.options.serverUrl,
        type: 'POST',
        data: {'coord' : ids}
      }).done(function(data) {
        self.appendData(data);
        if ( self.loaded ) {
          self.updateModelCounts();
          self.superimpose();
          self.styleModel();
          self.show();
        }
      });
    },

    appendData: function(data) {
      var self = this;
      if ( data.indexOf('MODEL') > -1 ) {
        jmolScriptWait("load DATA \"append structure\"\n" + data + 'end "append structure";');
        self.loaded = true;
      } else {
        console.error('Server returned: ' + data);
      }
    },

    updateModelCounts: function() {
      this.modelNumber = ++$.jmolTools.numModels;
    },

    // superimpose this model onto the first one using phosphate atoms
    superimpose: function() {
      var self = this,
          model = self.modelNumber,
          i = 0;
      if (self.superimposed || model < 2) { return; }

      for (i = 0; i < 3; i++) {
        // if the same number of phosphates, try to superimpose,
        // otherwise take the first four phosphates
        var command = 'if ({*.P/' + model + '.1}.length == {*.P/1.1}) ' +
          '{x=compare({*.P/' + model + '.1},{*.P/1.1});}' +
          'else {x=compare({(*.P/' + model + '.1)[1][4]},{(*.P/1.1)[1][4]});};' +
          'select ' + model + '.1,' + model + '.2; rotate selected @{x};';
        jmolScript(command);
      }

      self.superimposed = true;
    },

    styleModel: function() {
      if ( this.styled ) { return; }
      var self = this,
          model = self.modelNumber,
          command = 'select [U]/' + model + '.1; color navy;' +
            'select [G]/' + model + '.1; color chartreuse;' +
            'select [C]/' + model + '.1; color gold;' +
            'select [A]/' + model + '.1; color red;' +
            'select nucleic and ' + model + '.2; color grey;' +
            'select protein and ' + model + '.2; color purple;' +
            'select hetero  and ' + model + '.2; color pink;' +
            'select ' + model + '.2; color translucent 0.8;' +
            'select ' + model + '.1,' + model + '.2;' +
            'spacefill off;' +
            'center ' + model + '.1;' +
            'zoom {'  + model + '.1} 0;';
      jmolScript(command);
      self.styled = true;
    },

    show: function() {
      var self = this,
          model = self.modelNumber,
          command = '';

      if (!self.loaded) {
        self.loadData();
      }

      if (self.neighborhood) {
        command = 'frame *;display displayed or ' + model + '.1,' + model + '.2; center ' + model + '.1;';
      } else {
        command = 'frame *;display displayed or '      + model + '.1;' +
          'frame *;display displayed and not ' + model + '.2;' +
          'center ' + model + '.1;';
      }
      jmolScript(command);
      self.hidden = false;
    },

    hide: function () {
      console.log('hide');
      var self = this,
          model = self.modelNumber;
      if (self.loaded) {
        var command = 'frame *;display displayed and not ' + model + '.1;' +
          'display displayed and not ' + model + '.2;';
          jmolScript(command);
        self.hidden  = true;
      }
    },

    hideAll: function() {
      jmolScript('hide *');
      $.each($.jmolTools.models, function() {
        this.hidden = true;
      });
    },

    jmolToggle: function() {
      var self = $.jmolTools.models[this.id];
      console.log('jmolToggle', self.hidden);
      return (self.hidden ? self.hide() : self.show());
    },

    jmolShow: function() {
      var self = $.jmolTools.models[this.id];
      self.loadData();
      self.show();
    },

    jmolHide: function() {
      var self = $.jmolTools.models[this.id];
      self.hide();
    },

    toggleNeighborhood: function() {
      var self = this;
      self.neighborhood = !self.neighborhood;
      if ( !self.hidden && self.loaded ) {
        self.show();
      }
    }

  };

  var Helpers = {

    toggleStereo: function() {
      if ($.jmolTools.stereo) {
        jmolScript('stereo off;');
      } else {
        jmolScript('stereo on;');
      }
      $.jmolTools.stereo = !$.jmolTools.stereo;
    },

    toggleNumbers: function() {
      if ($(this).is(':checked')) {
        jmolScript("select {*.C1'},{*.CA};label %[sequence]%[resno];color labels black;");
      } else {
        jmolScript('label off;');
      }
    },

    toggleNeighborhood: function() {
      $.each($.jmolTools.models, function(ind, model) {
        model.toggleNeighborhood();
      });
    },

    showAll: function() {
      $.each($.jmolTools.models, function(ind, model) {
        if ( ! model.loaded ) {
          model.loadData();
        } else {
          model.show();
        }
        // model.toggleCheckbox();
      });
    },

    hideAll: function() {
      $.jmolTools.models[$.fn.jmolTools.elems[0].id].hideAll();
    },

    showNext: function() {
      var elems = $($.jmolTools.selector), // can't use cache because the element order can change
          last = elems.length - 1,
          indToCheck = [],
          i = 0;

      // figure out which ones should be checked
      for (i = 0; i < elems.length-1; i++) {
        if ( elems[i].checked ) {
          indToCheck.push(i+1); // the next one should be checked
          $.jmolTools.models[elems[i].id].jmolToggle.apply(elems[i]); // toggle this model
        }
      }

      // analyze the last one
      if ( elems[last].checked ) {
        $.jmolTools.models[elems[last].id].jmolToggle.apply(elems[last]);
      }

      // uncheck all
      elems.filter(':checked').prop('checked', false);

      // check only the right ones
      $.each(indToCheck, function(ind, id) {
        elems[id].checked = true;
        $.jmolTools.models[elems[id].id].jmolToggle.apply(elems[id]);
      });

      // keep the first one checked if all are unchecked
      if ( elems.filter(':checked').length === 0 ) {
        elems[0].checked = true;
        $.jmolTools.models[elems[0].id].jmolToggle.apply(elems[0]);
      }
    },

    showPrev: function() {
      var elems = $($.jmolTools.selector), // can't use cache because the element order can change
          last = elems.length - 1,
          indToCheck = [],
          i = 0;

      // loop over all checkboxes except for the first one
      for (i = elems.length-1; i >= 1; i--) {
        if ( elems[i].checked ) {
          indToCheck.push(i-1);
          $.jmolTools.models[elems[i].id].jmolToggle.apply(elems[i]); // toggle this model
        }
      }
      // separate handling of the first checkbox
      if ( elems[0].checked ) {
        indToCheck.push(elems.length-1);
        $.jmolTools.models[elems[0].id].jmolToggle.apply(elems[0]);
      }

      // temporarily uncheck everything
      elems.filter(':checked').prop('checked', false);

      // check only the right ones
      $.each(indToCheck, function(ind, id) {
        elems[indToCheck[i]].checked = true;
        $.jmolTools.models[elems[id].id].jmolToggle.apply(elems[id]);
      });
      // keep the last checkbox checked if all others are unchecked
      if ( elems.filter(':checked').length === 0 ) {
        elems[last].checked = true;
        $.jmolTools.models[elems[last].id].jmolToggle.apply(elems[last]);
      }
    },

    reportLoadingBegan: function() {
      // jmolScript('set echo top left; color echo green; echo Loading...;');
    },

    reportLoadingComplete: function() {
      // jmolScript('set echo top left; color echo green; echo Done;');
    },

    reportClear: function() {
      // jmolScript('set echo top left; echo ;');
    },

    bindEvents: function() {
      $('#' + $.fn.jmolTools.options.showStereoId).on('click', Helpers.toggleStereo);
      $('#' + $.fn.jmolTools.options.showNeighborhoodId).on('click', Helpers.toggleNeighborhood);
      $('#' + $.fn.jmolTools.options.showNumbersId).on('click', Helpers.toggleNumbers);
      $('#' + $.fn.jmolTools.options.showAllId)
        .toggle(Helpers.showAll, Helpers.hideAll);
      $('#' + $.fn.jmolTools.options.showNextId).on('click', Helpers.showNext);
      $('#' + $.fn.jmolTools.options.showPrevId).on('click', Helpers.showPrev);
      $('#' + $.fn.jmolTools.options.clearId).on('click', Helpers.hideAll);

      $(document).ajaxSend(function() {
        Helpers.reportLoadingBegan();
      });

      $(document).ajaxStop(function() {
        Helpers.reportLoadingComplete();
        setTimeout(Helpers.reportClear, 1200);
      });
    },

  };

  // plugin initialization
  $.fn.jmolTools = function(options) {

    $.jmolTools.selector = $(this).selector;

    $.fn.jmolTools.options = $.extend({}, $.fn.jmolTools.options, options);

    // bind events
    Helpers.bindEvents();

    // initialize model state for each element
    $.fn.jmolTools.elems = this.each( function() {
      // create a new object to keep track of state
      var jmdb = Object.create( jmolModel );
      jmdb.init( options, this );
      // store the object
      $.jmolTools.models[this.id] = jmdb;
    });

    // add convenience methods to toggle structures
    $.fn.jmolToggle = function () {
      return this.each( function() {
        $.jmolTools.models[this.id].jmolToggle.apply(this);
      });
    };

    $.fn.jmolShowOne = function () {
      console.log(this);
      // return this.each( function() {
      //   $.jmolTools.models[this.id].jmolShow.apply(this);
      // });
    };

    $.fn.jmolShow = function () {
      console.log(this);
      // return this.each( function() {
      //   $.jmolTools.models[this.id].jmolShow.apply(this);
      // });
    };

    $.fn.jmolHide = function () {
      return this.each( function() {
        $.jmolTools.models[this.id].jmolHide.apply(this);
      });
    };

    // return elements for chaining
    return $.fn.jmolTools.elems;
  };

  var env = window.location.href.split('/')[3]; // rna3dhub or rna3dhub_dev
  if ( env !== 'rna3dhub' && env !== 'rna3dhub_dev' ) {
    env = 'rna3dhub';
  }

  // default options
  $.fn.jmolTools.options = {
    serverUrl:          'http://rna.bgsu.edu/' + env + '/rest/getCoordinates',
    dataAttribute:      'unit-ids',
    toggleCheckbox:     false,
    mutuallyExclusive:  false,
    showNeighborhoodId: false,
    showNextId:         false,
    showPrevId:         false,
    showAllId:          false,
    showNumbersId:      false,
    showStereoId:       false,
    clearId:            false
  };

}(jQuery));
