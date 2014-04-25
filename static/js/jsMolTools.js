/*jshint devel: true */
(function () {
  'use strict';
  /*global document, jmolScriptWait, jmolScript, $, window */
  // TODO: Remove deps on global stuff

  var modelCache = {},
      modelCount = 0,
      showNumbers = false,
      defaults = {
        models: {
          styleMethod: 'sequence',
          superimposeMethod: 'phosphate',
          env: 'rna3dhub'
        },
        controls: { }
      };

  function Model(options) {
    this.modelNumber = null;
    this.loaded = false;
    this.neighborhood = false;
    this.superimposed = false;
    this.styled = false;
    this.hidden = true;
    this.env = options.env;
    this.styleMethod = options.styleMethod;
    this.superimposeMethod = options.superimposeMethod;
    this.id = options.id;
    this.unit_ids = options.unit_ids || [];
    this.data = null;
    this._url = options.url;

    if (options.elem) {
      var elem = $(options.elem);
      if (options.attr) {
        this.unit_ids = elem.data(options.attr);
      }
    }

  }

  Model.prototype.bind = function() {
    var self = this;
    this.$elem.on('click', function() { self.toggle(); });
  };

  Model.prototype.load = function() {
    var self = this;

    if (this.loaded) { return null; }

    return $.get(this._url).done(function(data) {
      if (self.appendData(data)) {
        self.show();
      }
    });
  };

  Model.prototype.appendData = function(data) {
    this.data = data;

    // TODO: Remove the usage of jmolScriptWait
    // TODO: Consider using the JSON formatted data
    var cmd = 'load DATA "append structure"\n' + data + '\nend "append structure";';
    jmolScriptWait(cmd);
    this.loaded = true;
    modelCount += 1;
    this.modelNumber = modelCount;
    return true;
  };

  Model.prototype.loadingFailed = function() {
    jmolScript('set echo top right; color echo red; echo Failed to load a model;');
  };

  Model.prototype.superimpose = function() {
    var method = this.superimposeMethod;
    if (this.superimposed) {
      return true;
    }

    if (method === 'phosphate') {
      return this.superimposeByPhophate();
    }
    if (method === null) {
      return true;
    }

    console.error("Unknown superimposing method: " + method);
  };

  Model.prototype.superimposeByPhophate = function() {
    var model = this.modelNumber;

    if (this.superimposed || model === 1) { return; }

    // if the same number of phosphates, try to superimpose,
    // otherwise take the first four phosphates
    var cmd = ' x = compare {' + model + '.1} {1.1};\n' +
      'select ' + model + '.1,' + model + '.2;\nrotate @{x};';
    jmolScript(cmd);

    this.superimposed = true;
    return true;
  };

  Model.prototype.styleBySequence = function() {
    if (this.styled || this.modelNumber === null) { return; }

    var model = this.modelNumber,
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
    this.styled = true;
  };

  Model.prototype.style = function() {
    var method = this.styleMethod;
    if (method === 'sequence') {
      this.styleBySequence();
    } else if (method === 'null') {
      this.styled = null;
    } else {
      console.log('Unknown styling method: ' + method);
    }
  };

  Model.prototype.show = function() {
    var model = this.modelNumber,
        command = '';

    if (!this.loaded) {
      return this.load();
    }
    this.superimpose();
    this.style();

    if (this.neighborhood) {
      command = 'frame *;display displayed or ' + model + '.1,' + model +
        '.2; center ' + model + '.1;';
    } else {
      command = 'frame *;display displayed or '      + model + '.1;' +
        'frame *;display displayed and not ' + model + '.2;' +
        'center ' + model + '.1;';
    }
    jmolScript(command);
    updateNumbers();
    this.hidden = false;
  };

  Model.prototype.hide = function() {
    var model = this.modelNumber;
    if (!this.loaded) { return; }
    jmolScript('frame *;display displayed and not ' + model + '.1;' +
      'display displayed and not ' + model + '.2;');
    this.hidden  = true;
  };

  Model.prototype.toggle = function() {
    return (this.hidden ? this.show() : this.hide());
  };

  Model.prototype.showNeighborHood = function() {
    if ( !this.hidden && this.loaded ) {
      this.show();
    }
    this.neighborhood = true;
  };

  Model.prototype.hideNeighborhood = function() {
  };

  Model.prototype.toggleNeighborhood = function() {
    return (this.neighborhood ? this.hideNeighborHood : this.showNeighborHood);
  };

  Model.prototype.url = function() {
    if (this._url) {
      return this._url;
    }

    if (this.env.slice(0, 5) !== 'http:') {
      var env = window.location.href.split('/');
      if (env !== 'rna3dhub' && env !== 'rna3dhub_dev') {
        env = 'rna3dhub';
      }
      return 'http://rna.bgsu.edu/' + env + '/rest/getCoordinates';
    }
    return this.env;
  };

  function ShowLoadingMessage() {
    jmolScript('set echo top left; color echo green; echo Loading...;');
  }

  function ShowDoneMessage() {
    jmolScript('set echo top left; color echo green; echo Done;');
    setTimeout(function () {
      jmolScript('set echo top left; echo ;');
    }, 1200);
  }

  function updateNumbers() {
      var cmd = 'label off;';
      if (showNumbers) {
        cmd = "select {*.C1'},{*.CA};label %[sequence]%[resno];color labels black;";
      }
      jmolScript(cmd);
  }

  window.jsMolTools = {};

  window.jsMolTools.showOnly = function(data) {
    var visible = {};
    data.forEach(function(datum) {
      var id = datum.id,
          config = $.extend({}, defaults.models, datum),
          model = modelCache[id] || new Model(config);
      modelCache[id] = model;
      visible[id] = model;
    });

    $(document).ajaxStart(ShowLoadingMessage);
    $(document).ajaxStop(ShowDoneMessage);

    // TODO: Merge all requests and only display once to make things efficent
    $.each(modelCache, function(id, model) {
      var fn = (!visible[id] ? model.hide : model.show);
      fn.call(model);
    });

  };

  window.jsMolTools.toggleNumbers = (function() {
    return function() {
      showNumbers = !showNumbers;
      updateNumbers();
    };
  }());

}());
