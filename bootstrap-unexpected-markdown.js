/*global unexpected:true, expect:true, jsdom:true, createElement:true, window:true, document:true*/
/* eslint no-unused-vars: "off" */

if (typeof expect === 'undefined') {
  require('./test/common/node');
}

unexpected = expect;
unexpected.output.preferredWidth = 80;

createElement = function createElement(html) {
  var root = document.createElement('div');

  root.innerHTML = html
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\s*\n\s*</gm, '<')
    .replace(/>\s*\n\s*/gm, '>')
    .trim();

  return root.firstChild;
};

window = new jsdom.JSDOM().window;
document = window.document;
