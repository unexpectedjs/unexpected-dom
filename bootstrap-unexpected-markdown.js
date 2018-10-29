/*global unexpected:true, expect:true, createElement:true*/ //eslint-disable-line no-unused-vars
unexpected = require('unexpected').clone();
unexpected.output.preferredWidth = 80;
unexpected.use(require('./src/'));

var jsdom = require('jsdom');
var window = new jsdom.JSDOM().window;
var document = window.document;

createElement = function createElement(html) {
  var root = document.createElement('div');

  root.innerHTML = html
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\s*\n\s*</gm, '<')
    .replace(/>\s*\n\s*/gm, '>')
    .trim();

  return root.firstChild;
};

expect = unexpected;
