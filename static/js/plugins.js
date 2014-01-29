/*global jQuery, window, Handlebars */

// Avoid `console` errors in browsers that lack a console.
(function() {
    var method;
    var noop = function () {};
    var methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];

        // Only stub undefined methods.
        if (!console[method]) {
            console[method] = noop;
        }
    }
}());

// Place any jQuery/helper plugins in here.
(function($) {
  var compiled = {};

  $.fn.handlebars = function(name, data, callback) {
    var $this = $(this);

    if (!compiled.hasOwnProperty(name)) {
      var url = "static/templates/" + name + ".html";
      $.get(url, function(template) {
        compiled[name] = Handlebars.compile(template);
        var content = compiled[name](data);
        $this.append(content);
        callback();
      });
    } else {
      this.append(compiled[name](data));
      callback();
    }
  };
}(jQuery));
