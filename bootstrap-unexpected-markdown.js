/* global expect:true, jsdom:true, createElement:true, createDocument:true */
/* eslint no-unused-vars: "off" */

const common = require('./test/common/node');
jsdom = common.jsdom;
expect = common.expect;
expect.output.preferredWidth = 80;

function sanitizeHtml(html) {
  return html
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\s*\n\s*</gm, '<')
    .replace(/>\s*\n\s*/gm, '>')
    .trim();
}

createElement = function createElement(html) {
  const root = document.createElement('div');

  root.innerHTML = sanitizeHtml(html);

  return root.firstChild;
};

/* eslint-disable no-global-assign */
window = new jsdom.JSDOM().window;
document = window.document;

createDocument = function createDocument(html) {
  return new jsdom.JSDOM(`<body>${sanitizeHtml(html)}</body>`).window.document;
};

/* eslint-disable no-global-assign */
document = window.document;
