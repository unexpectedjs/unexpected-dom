/*global describe, it*/
var unexpected = require('unexpected'),
    unexpectedDom = require('../lib/index'),
    jsdom = require('jsdom');

describe('unexpected-dom', function () {
  var expect = unexpected.clone().installPlugin(unexpectedDom);
  expect.output.installPlugin(require('magicpen-prism'));

  it('should consider two DOM elements equal when they have the same outerHTML', function () {
    expect(jsdom.jsdom('<div>foobar</div>'), 'to equal', jsdom.jsdom('<div>foobar</div>'));
  });

  it('should consider two DOM elements different when their outerHTML values differ', function () {
    expect(function () {
      expect(jsdom.jsdom('<!DOCTYPE html><div>foobarbaz</div>'), 'to equal', jsdom.jsdom('<div class="hey">foobarquux</div><!--blahblah-->'));
    }, 'to throw exception', function (err) {
      expect(err.output.toString(), 'to equal',
        'expected <!DOCTYPE html><div>foobarbaz</div> to equal <div class="hey">foobarquux</div><!--blahblah-->\n' +
        '\n' +
        '-<!DOCTYPE html><div>foobarbaz</div>\n' +
        '+<div class="hey">foobarquux</div><!--blahblah-->');
    });
  });
});
