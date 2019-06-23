/*global unexpected:true, expect:true, jsdom:true, createElement:true*/
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

/* eslint-disable no-global-assign */
window = new jsdom.JSDOM().window;
document = window.document;
