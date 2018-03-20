/*global unexpected:true, expect:true, window:true, document:true, body:true, createElement:true*/ //eslint-disable-line no-unused-vars
unexpected = require('unexpected').clone();
unexpected.output.preferredWidth = 80;
unexpected.use(require('./lib/'));
var jsdom = require('jsdom');
window = new jsdom.JSDOM().window;
document = window.document;
body = document.body;

createElement = function createElement(text) {
  var root = document.createElement('div');
  root.innerHTML = text.trim();
  return root.firstChild;
};

expect = unexpected;
