const unexpected = require('unexpected');
const unexpectedDom = require('../src/index');
const jsdom = require('jsdom');

const expect = unexpected.clone().installPlugin(unexpectedDom);
expect.output.installPlugin(require('magicpen-prism'));

expect.addAssertion(
  '<string|DOMNode> to inspect as [itself] <string?>',
  function (expect, subject, value) {
    const originalSubject = subject;
    if (typeof subject === 'string') {
      subject = new jsdom.JSDOM(
        `<!DOCTYPE html><html><head></head><body>${subject}</body></html>`,
      ).window.document.body.firstChild;
    }
    if (this.flags.itself) {
      if (typeof originalSubject === 'string') {
        expect(expect.inspect(subject).toString(), 'to equal', originalSubject);
      } else {
        throw new Error(
          'subject must be given as a string when expected to inspect as itself',
        );
      }
    } else {
      expect(expect.inspect(subject).toString(), 'to equal', value);
    }
  },
);

describe('jsdom bug compatibility', () => {
  it('should work without issue #1107 fixed', () => {
    // https://github.com/tmpvar/jsdom/issues/1107
    expect(
      '<select><option value="foo">bar</option></select>',
      'to inspect as itself',
    );
    expect('<form><p>foo</p></form>', 'to inspect as itself');
  });
});
