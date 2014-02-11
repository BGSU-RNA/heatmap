(function () {
  'use strict';
  /*global document, jmolScriptWait, jmolScript, $, window */
  // TODO: Remove deps on global stuff

  var modelCache = {},
      modelCount = 0,
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

    if (options.unit_ids) {
      this.unit_ids = options.unit_ids;
    } else if (options.attr && options.elem) {
      this.unit_ids = $(options.elem).data(options.attr);
    }
  }

  Model.prototype.bind = function() {
    var self = this;
    this.$elem.on('click', function() { self.toggle(); });
  };

  Model.prototype.load = function(show) {
    var ids = this.unit_ids,
        self = this,
        request = {url: this.url(), type: 'POST', data: {coord : ids}};

    if (typeof(ids) !== 'string') {
      request.data.coord = ids.join(',');
    }

    if (this.loaded) { return null; }

    return $.ajax(request).done(function(data) {
      if (self.appendData(data) && show) {
        self.show();
      }
    });
  };

  Model.prototype.appendData = function(data) {
    if (data.indexOf('MODEL') === -1) {
      this.loadingFailed(data);
      this.loaded = true; // TODO: Better handling when loading fails
      return false;
    }
    // TODO: Remove the usage of jmolScriptWait
    jmolScriptWait("load DATA \"append structure\"\n" + data + 'end "append structure";');
    this.loaded = true;
    modelCount += 1;
    this.modelNumber = modelCount;
    return true;
  };

  Model.prototype.loadingFailed = function() {
    jmolScript('set echo top right; color echo red; echo Failed to load a model...;');
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
    var model = this.modelNumber,
        i = 0;

    if (this.superimposed || model === 1) { return; }

    for (i = 0; i < 3; i++) {
      // if the same number of phosphates, try to superimpose,
      // otherwise take the first four phosphates
      jmolScript('if ({*.P/' + model + '.1}.length == {*.P/1.1}) ' +
        '{x=compare({*.P/' + model + '.1},{*.P/1.1});}' +
        'else {x=compare({(*.P/' + model + '.1)[1][4]},{(*.P/1.1)[1][4]});};' +
        'select ' + model + '.1,' + model + '.2; rotate selected @{x};');
    }

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
      this.load(true);
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

}());
