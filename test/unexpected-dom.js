/*global describe, it, beforeEach*/
var unexpected = require('unexpected'),
    unexpectedDom = require('../lib/index'),
    jsdom = require('jsdom');

var expect = unexpected.clone().installPlugin(unexpectedDom);
expect.output.installPlugin(require('magicpen-prism'));

expect.addAssertion('to inspect as [itself]', function (expect, subject, value) {
  var originalSubject = subject;
  if (typeof subject === 'string') {
    subject = jsdom.jsdom('<!DOCTYPE html><html><head></head><body>' + subject + '</body></html>').body.firstChild;
  }
  if (this.flags.itself) {
    if (typeof originalSubject === 'string') {
      expect(expect.inspect(subject).toString(), 'to equal', originalSubject);
    } else {
      throw new Error('subject must be given as a string when expected to inspect as itself');
    }
  } else {
    expect(expect.inspect(subject).toString(), 'to equal', value);
  }
});

describe('unexpected-dom', function () {
  beforeEach(function (done) {
    var self = this;
    jsdom.env(' ', function (err, window) {
      self.window = window;
      self.document = window.document;
      self.body = window.document.body;

      done();
    });
  });

  it('should inspect a document correctly', function () {
    expect(
      jsdom.jsdom('<!DOCTYPE html><html><head></head><body></body></html>'),
      'to inspect as',
      '<!DOCTYPE html><html><head></head><body></body></html>'
    );
  });

  it('should inspect a document with nodes around the documentElement correctly', function () {
    expect(
      jsdom.jsdom('<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->'),
      'to inspect as',
      '<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->'
    );
  });

  it('should inspect an attribute-less element correctly', function () {
    expect('<div></div>', 'to inspect as itself');
  });

  it('should dot out descendants at level >= 3 when inspecting', function () {
    expect('<div><div><div><div>foo</div></div></div></div>', 'to inspect as', '<div><div><div>...</div></div></div>');
  });

  it('should inspect void elements correctly', function () {
    expect('<input type="text">', 'to inspect as itself');
  });

  it('should inspect simple attributes correctly', function () {
    expect('<input disabled type="text">', 'to inspect as itself');
  });

  it('should allow regular assertions defined for the object type to work on an HTMLElement', function () {
    expect(jsdom.jsdom('<html><head></head><body></body></html>').firstChild, 'to have properties', { nodeType: 1 });
  });

  it('should consider two DOM elements equal when they are of same type and have same attributes', function () {
    var document = this.document;

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

  it('should to things', function () {
    //expect(this.document.createElement('p'), 'to match', '<p />');
  });

  describe('to have attributes', function () {
    describe('argument comparison', function () {
      it('should match exact arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', 'id', 'class', 'data-info', 'disabled');
      });

      it('should fail on exact arguments not met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to only have attributes', 'id');
        }, 'to throw exception',
            'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button> to only have attributes \'id\''
        );
      });

      it('should match partial arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to have attributes', 'id', 'class');
      });

      it('should fail on partial arguments not met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have attributes', 'id', 'foo');
        }, 'to throw exception', function (err) {
          expect(err.output.toString(), 'to be',
            'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button> to have attributes \'id\', \'foo\'');
        });
      });
    });

    describe('array comparison', function () {
      it('should match exact arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', ['id', 'class', 'data-info', 'disabled']);
      });

      it('should fail on exact arguments not met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to only have attributes', ['id']);
        }, 'to throw exception', function (err) {
          expect(err.output.toString(), 'to be', 'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button> to only have attributes [ \'id\' ]');
        });
      });

      it('should match partial arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to have attributes', ['id', 'class']);
      });

      it('should fail on partial arguments not met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have attributes', ['id', 'foo']);
        }, 'to throw exception', function (err) {
          expect(err.output.toString(), 'to be', 'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button> to have attributes [ \'id\', \'foo\' ]');
        });
      });
    });

    describe('object comparison', function () {
      it('should match exact object', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', {
          id: 'foo',
          'class': 'bar',
          'data-info': 'baz',
          disabled: true
        });
      });

      it('should fail on exact object not satisfied', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to only have attributes', {
            id: 'foo'
          });
        }, 'to throw exception', /^expected <button class="bar" data-info="baz" disabled id="foo">Press me<\/button> to only have attributes/);
      });

      it('should match partial object', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to have attributes', {
          id: 'foo',
          'class': 'bar'
        });
      });

      it('should fail on partial object not satisfied', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have attributes', {
            id: 'foo',
            foo: 'bar'
          });
        }, 'to throw exception', /expected <button class="bar" data-info="baz" disabled id="foo">Press me<\/button>\nto have attributes/);
      });
    });
  });

  describe('to have children', function () {
    describe('with no children flag', function () {
      it('should match element with no children', function () {
        this.body.innerHTML = '<div></div>';
        var el = this.body.firstChild;

        expect(el, 'to have no children');
      });

      it('should fail on element with HTMLElement children', function () {
        this.body.innerHTML = '<div><p></p></div>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have no children');
        }, 'to throw', /^expected <div><p><\/p><\/div> to have no children/);
      });

      it('should fail on element with HTMLComment children', function () {
        this.body.innerHTML = '<div><!-- Comment --></div>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have no children');
        }, 'to throw', /^expected <div><!-- Comment --><\/div> to have no children/);
      });

      it('should fail on element with TextNode children', function () {
        this.body.innerHTML = '<div>I am a text</div>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have no children');
        }, 'to throw', /^expected <div>I am a text<\/div> to have no children/);
      });
    });
  });

  describe('queried for', function () {
    it('should work with HTMLDocument', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div id="foo"></div></body></html>');
      expect(document, 'queried for first', 'div', 'to have attributes', { id: 'foo' });
    });

    it('should error out if the selector matches no elements, first flag set', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div id="foo"></div></body></html>');
      expect(function () {
        expect(document.body, 'queried for first', '.blabla', 'to have attributes', { id: 'foo' });
      }, 'to throw error',
          'expected <body><div id="foo"></div></body> queried for first \'.blabla\', \'to have attributes\', { id: \'foo\' }\n' +
          '  The selector .blabla yielded no results'
      );
    });

    it('should error out if the selector matches no elements, first flag not set', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div id="foo"></div></body></html>');
      expect(function () {
        expect(document.body, 'queried for', '.blabla', 'to have attributes', { id: 'foo' });
      }, 'to throw error',
          'expected <body><div id="foo"></div></body> queried for \'.blabla\', \'to have attributes\', { id: \'foo\' }\n' +
          '  The selector .blabla yielded no results'
      );
    });
  });

  describe('diffing', function () {
    function parseHtmlElement(str) {
      return jsdom.jsdom('<!DOCTYPE html><html><body>' + str + '</body></html>').body.firstChild;
    }

    expect.addAssertion(['string', 'DOMNode'], 'diffed with', function (expect, subject, value) {
      if (typeof subject === 'string') {
        subject = parseHtmlElement(subject);
      }
      if (typeof value === 'string') {
        value = parseHtmlElement(value);
      }
      this.shift(expect, expect.diff(subject, value).diff.toString(), 1);
    });

    it('should work with HTMLElement', function () {
      expect(
        '<div><div id="foo"></div><div id="bar"></div></div>',
        'diffed with',
        '<div><div id="foo"></div><div id="quux"></div></div>',
        'to equal',
        '<div>\n' +
        '  <div id="foo"></div>\n' +
        '  -<div id="bar"></div>\n' +
        '  +<div id="quux"></div>\n' +
        '</div>');
    });

    it('should work with HTMLElement with text nodes and comments inside', function () {
      expect(
        '<div>foo<!--bar--></div>',
        'diffed with',
        '<div>quux<!--baz--></div>',
        'to equal',
        '<div>\n' +
        '  -foo\n' +
        '  +quux\n' +
        '  -<!--bar-->\n' +
        '  +<!--baz-->\n' +
        '</div>');
    });

    it('should report a missing child correctly', function () {
      expect(
        '<div>foo<!--bar--></div>',
        'diffed with',
        '<div>foo<span></span><!--bar--></div>',
        'to equal',
        '<div>\n' +
        '  foo\n' +
        '  // missing <span></span>\n' +
        '  <!--bar-->\n' +
        '</div>');
    });

    it('should report an extraneous child correctly', function () {
      expect(
        '<div>foo<span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<!--bar--></div>',
        'to equal',
        '<div>\n' +
        '  foo\n' +
        '  <span></span> // should be removed\n' +
        '  <!--bar-->\n' +
        '</div>');
    });

    it('should produce a nested diff when the outer elements are identical', function () {
      expect(
        '<div>foo<span><span>foo</span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<span><span>bar</span></span><!--bar--></div>',
        'to equal',
        '<div>\n' +
        '  foo\n' +
        '  <span>\n' +
        '    <span>\n' +
        '      -foo\n' +
        '      +bar\n' +
        '    </span>\n' +
        '  </span>\n' +
        '  <!--bar-->\n' +
        '</div>');
    });

    it('should produce a nested diff when when the outer element has a different set of attributes', function () {
      expect(
        '<div>foo<span id="foo" class="bar"><span>foo</span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<span><span>bar</span></span><!--bar--></div>',
        'to equal',
        '<div>\n' +
        '  foo\n' +
        '  -<span class="bar" id="foo">\n' +
        '  +<span>\n' +
        '    <span>\n' +
        '      -foo\n' +
        '      +bar\n' +
        '    </span>\n' +
        '  </span>\n' +
        '  <!--bar-->\n' +
        '</div>');
    });

    it('should diff documents with stuff around the documentElement', function () {
      expect(
        jsdom.jsdom('<!DOCTYPE html><!--foo--><html><body></body></html><!--bar-->'),
        'diffed with',
        jsdom.jsdom('<!DOCTYPE html><html><body></body></html>'),
        'to equal',
            '<!DOCTYPE html>\n' +
            '<!--foo--> // should be removed\n' +
            '<html><body></body></html>\n' +
            '<!--bar--> // should be removed'
        );
    });
  });
});
