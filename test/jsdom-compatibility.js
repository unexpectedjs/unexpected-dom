/*global describe, it*/
var unexpected = require('unexpected');
var unexpectedDom = require('../src/index');
var jsdom = require('jsdom');

var expect = unexpected.clone().installPlugin(unexpectedDom);
expect.output.installPlugin(require('magicpen-prism'));

expect.addAssertion('to inspect as [itself]', function(expect, subject, value) {
  var originalSubject = subject;
  if (typeof subject === 'string') {
    subject = new jsdom.JSDOM(
      '<!DOCTYPE html><html><head></head><body>' + subject + '</body></html>'
    ).window.document.body.firstChild;
  }
  if (this.flags.itself) {
    if (typeof originalSubject === 'string') {
      expect(expect.inspect(subject).toString(), 'to equal', originalSubject);
    } else {
      throw new Error(
        'subject must be given as a string when expected to inspect as itself'
      );
    }
  } else {
    expect(expect.inspect(subject).toString(), 'to equal', value);
  }
});

describe('jsdom bug compatibility', function() {
  it('should work without issue #1107 fixed', function() {
    // https://github.com/tmpvar/jsdom/issues/1107
    expect(
      '<select><option value="foo">bar</option></select>',
      'to inspect as itself'
    );
    expect('<form><p>foo</p></form>', 'to inspect as itself');
  });
});
