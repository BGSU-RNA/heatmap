/* globals Jmol */

Jmol.getProfile();

var jsMolSize = 300;

var config = {
  width: jsMolSize,
  height: jsMolSize,
  debug: false,
  // color: "white",
  color: "#F0F0F0",
  addSelectionOptions: false,
  use: "HTML5",
  j2sPath: "static/jsmol/j2s",
  isSigned: false,
  disableJ2SLoadMonitor: true,
  disableInitialConsole: true,
  allowjavascript: true
};
jmolApplet0 = Jmol.getApplet("jmolApplet0", config);

// these are conveniences that mimic behavior of Jmol.js and
// required for jmolTools to work.
function jmolScript(cmd) {Jmol.script(jmolApplet0, cmd)};
function jmolScriptWait(cmd) {Jmol.scriptWait(jmolApplet0, cmd)};
