function extend(out) {
  var i, key;
  out = out || {};

  for (i = 1; i < arguments.length; i+=1) {
    if (!arguments[i]) {
      continue;
    }

    for (key in arguments[i]) {
      if (arguments[i].hasOwnProperty(key)) {
        out[key] = arguments[i][key];
      }
    }
  }

  return out;
}

function accessor(initial, callback) {
  return (function() {
    var value = initial;
    return function(x) {
      if (!arguments.length) {
        return value;
      }
      if (callback) {
        callback(value, x);
      }
      value = x;
      return this;
    };
  }());
}

(function (global, factory) {
  if (typeof define === "function" && define.amd) { define(factory); }
  else if (typeof module === "object") { module.exports = factory(); }
  else { global.augment = factory(); }
}(this, function () {
  "use strict";

  var Factory = function () {};
  var slice = Array.prototype.slice;

  return function (base, body) {
    var uber = Factory.prototype = typeof base === "function" ? base.prototype : base;
    var prototype = new Factory;
    body.apply(prototype, slice.call(arguments, 2).concat(uber));
    if (!prototype.hasOwnProperty("constructor")) return prototype;
    var constructor = prototype.constructor;
    constructor.prototype = prototype;
    return constructor;
  };
}));

function dispatch(obj, method) {
  return function() { return obj[method].apply(obj, arguments); };
}
