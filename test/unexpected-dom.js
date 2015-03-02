/*global describe, it*/
var unexpected = require('unexpected'),
    unexpectedDom = require('../lib/index'),
    jsdom = require('jsdom');

var expect = unexpected.clone().installPlugin(unexpectedDom);
expect.output.installPlugin(require('magicpen-prism'));

describe('unexpected-dom', function () {

  it('should consider two DOM elements equal when they are of same type and have same attributes', function () {
    jsdom.env('<h1>Hello world</h1>', function (err, window) {
      var document = window.document;

      var el1 = document.createElement('h1');
      var el2 = document.createElement('h1');
      var el3 = document.createElement('h1');
      el3.id = 'el3';
      var paragraph = document.createElement('p');

      expect(el1, 'to be', el1);
      expect(el1, 'not to be', el2);
      expect(el1, 'to equal', el2);
      expect(el1, 'not to equal', el3);
      expect(el1, 'not to equal', paragraph);
    });
  });

});
