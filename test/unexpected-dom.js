/*global describe, it, beforeEach, afterEach*/
var unexpected = require('unexpected'),
    unexpectedDom = require('../lib/index'),
    sinon = require('sinon'),
    jsdom = require('jsdom');

var expect = unexpected.clone().installPlugin(require('unexpected-sinon')).installPlugin(unexpectedDom);

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

expect.addAssertion('to produce a diff of', function (expect, subject, value) {
  this.errorMode = 'bubble';
  subject = subject.map(function (item) {
    return typeof item === 'string' ? jsdom.jsdom('<!DOCTYPE html><html><head></head><body>' + item + '</body></html>').body.firstChild : item;
  });
  expect(expect.diff(
    subject[0],
    subject[1]
  ).diff.toString(), 'to equal', value);
});

function parseHtml(str) {
  return jsdom.jsdom('<!DOCTYPE html><html><body>' + str + '</body></html>').body.firstChild;
}

describe('unexpected-dom', function () {
  expect.output.preferredWidth = 100;

  var document, body;
  beforeEach(function (done) {
    var self = this;
    jsdom.env(' ', function (err, window) {
      self.window = window;
      document = self.document = window.document;
      body = self.body = window.document.body;

      done();
    });
  });

  it('should inspect an HTML document correctly', function () {
    expect(
      jsdom.jsdom('<!DOCTYPE html><html><head></head><BODY></BODY></html>'),
      'to inspect as',
      '<!DOCTYPE html><html><head></head><body></body></html>'
    );
  });

  it('should inspect an XML document correctly', function () {
    expect(
      '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>',
      'when parsed as XML',
      'to inspect as',
      '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>'
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

  it('should inspect undefined attributes correctly', function () {
    expect('<input value="">', 'to inspect as itself');
  });

  describe('diffing', function () {
    it('should diff elements with different node names', function () {
      expect(
        ['<div></div>', '<span></span>'],
        'to produce a diff of',
        '<div // should be span\n></div>'
      );
    });

    it('should diff a mismatching attribute', function () {
      expect(
        ['<div id="foo"></div>', '<div id="bar"></div>'],
        'to produce a diff of',
        '<div id="foo" // should equal \'bar\'\n></div>'
      );
    });

    it('should diff a mismatching attribute with a char that needs entitification', function () {
      expect(
        ['<div id="foo&quot;bar"></div>', '<div id="quux&quot;baz"></div>'],
        'to produce a diff of',
        '<div id="foo&quot;bar" // should equal \'quux&quot;baz\'\n></div>'
      );
    });

    it('should diff multiple mismatching attributes', function () {
      expect(
        [
          '<div id="foo" the="same" heps="hey" something="identical"></div>',
          '<div id="bar" the="same" heps="there" something="identical"></div>'
        ],
        'to produce a diff of',
        '<div id="foo" // should equal \'bar\'\n' +
        '     the="same" heps="hey" // should equal \'there\'\n' +
        '     something="identical"></div>'
      );
    });

    it('should diff an extraneous attribute', function () {
      expect(
        ['<div id="foo"></div>', '<div></div>'],
        'to produce a diff of',
        '<div id="foo" // should be removed\n></div>'
      );
    });

    it('should diff a missing attribute', function () {
      expect(
        ['<div></div>', '<div id="foo"></div>'],
        'to produce a diff of',
        '<div // missing id="foo"\n></div>'
      );
    });

    it('should diff a missing attribute with a char that needs entitification', function () {
      expect(
        ['<div></div>', '<div id="fo&amp;o"></div>'],
        'to produce a diff of',
        '<div // missing id="fo&amp;o"\n></div>'
      );
    });

    it('should diff a child node', function () {
      expect(
        ['<div>foo</div>', '<div>bar</div>'],
        'to produce a diff of',
        '<div>\n' +
        '  -foo\n' +
        '  +bar\n' +
        '</div>'
      );
    });
  });

  it('should allow regular assertions defined for the object type to work on an HTMLElement', function () {
    expect(jsdom.jsdom('<html><head></head><body></body></html>').firstChild, 'to have properties', { nodeType: 1 });
  });

  it('should consider two DOM elements equal when they are of same type and have same attributes', function () {
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

  describe('to have text', function () {
    it('should succeed', function () {
      document.body.innerHTML = '<div>foo</div>';
      return expect(document.body, 'to have text', 'foo');
    });

    it('should fail with a diff', function () {
      document.body.innerHTML = '<div>foo</div>';
      expect(function () {
        expect(document.body, 'to have text', 'bar');
      }, 'to throw',
        'expected <body><div>foo</div></body> to have text \'bar\'\n' +
        '\n' +
        '-foo\n' +
        '+bar'
      );
    });

    it('should use "to satisfy" semantics', function () {
      document.body.innerHTML = '<div>foo</div>';
      return expect(document.body, 'to have text', /fo/);
    });
  });

  describe('to have class', function () {
    it('should handle a non-existing class', function () {
      body.innerHTML = '<button>Press me</button>';

      expect(function () {
        expect(body.firstChild, 'to have class', 'foo');
      }, 'to throw', 'expected <button>Press me</button> to have class \'foo\'\n\n<button\n        // missing class should satisfy \'foo\'\n>Press me</button>');
    });

    describe('with a single class passed as a string', function () {
      it('should succeed', function () {
        body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        expect(body.firstChild, 'to have class', 'bar');
      });

      it('should fail with a diff', function () {
        body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        expect(function () {
          expect(body.firstChild, 'to have class', 'quux');
        }, 'to throw',
            'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button> to have class \'quux\'\n' +
            '\n' +
            '<button id="foo" class="bar" // expected [ \'bar\' ] to contain \'quux\'\n' +
            '        data-info="baz" disabled>Press me</button>'
        );
      });
    });

    describe('with multiple classes passed as an array', function () {
      it('should succeed', function () {
        body.innerHTML = '<button id="foo" class="bar foo" data-info="baz" disabled>Press me</button>';
        expect(body.firstChild, 'to have classes', ['foo', 'bar']);
      });

      it('should fail with a diff', function () {
        body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        expect(function () {
          expect(body.firstChild, 'to have classes', ['quux', 'bar']);
        }, 'to throw',
          'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button>\n' +
          'to have classes [ \'quux\', \'bar\' ]\n' +
          '\n' +
          '<button id="foo" class="bar" // expected [ \'bar\' ] to contain \'quux\', \'bar\'\n' +
          '        data-info="baz" disabled>Press me</button>'
        );
      });
    });

    describe('with the "only" flag', function () {
      describe('with a single class passed as a string', function () {
        it('should succeed', function () {
          body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
          expect(body.firstChild, 'to only have class', 'bar');
        });

        it('should fail with a diff', function () {
          body.innerHTML = '<button id="foo" class="bar quux" data-info="baz" disabled>Press me</button>';
          expect(function () {
            expect(body.firstChild, 'to only have class', 'quux');
          }, 'to throw',
            'expected <button class="bar quux" data-info="baz" disabled id="foo">Press me</button>\n' +
            'to only have class \'quux\'\n' +
            '\n' +
            '<button id="foo" class="bar quux" // expected [ \'bar\', \'quux\' ] to equal [ \'quux\' ]\n' +
            '                                  //\n' +
            '                                  // [\n' +
            '                                  //   \'bar\', // should be removed\n' +
            '                                  //   \'quux\'\n' +
            '                                  // ]\n' +
            '        data-info="baz" disabled>Press me</button>'
          );
        });
      });

      describe('with multiple classes passed as an array', function () {
        it('should succeed', function () {
          body.innerHTML = '<button id="foo" class="bar foo" data-info="baz" disabled>Press me</button>';
          expect(body.firstChild, 'to only have classes', ['foo', 'bar']);
        });

        it('should fail with a diff', function () {
          body.innerHTML = '<button id="foo" class="bar quux foo" data-info="baz" disabled>Press me</button>';
          expect(function () {
            expect(body.firstChild, 'to only have classes', ['quux', 'bar']);
          }, 'to throw',
            'expected <button class="bar quux foo" data-info="baz" disabled id="foo">Press me</button>\n' +
            'to only have classes [ \'bar\', \'quux\' ]\n' +
            '\n' +
            '<button id="foo" class="bar quux foo" // expected [ \'bar\', \'foo\', \'quux\' ] to equal [ \'bar\', \'quux\' ]\n' +
            '                                      //\n' +
            '                                      // [\n' +
            '                                      //   \'bar\',\n' +
            '                                      //   \'foo\', // should be removed\n' +
            '                                      //   \'quux\'\n' +
            '                                      // ]\n' +
            '        data-info="baz" disabled>Press me</button>'
          );
        });
      });
    });
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
        }, 'to throw',
            'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button>\n' +
            'to only have attributes \'id\'\n' +
            '\n' +
            '<button id="foo" class="bar" // should be removed\n' +
            '        data-info="baz" // should be removed\n' +
            '        disabled // should be removed\n' +
            '>Press me</button>'
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
        }, 'to throw',
            'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button>\n' +
            'to have attributes \'id\', \'foo\'\n' +
            '\n' +
            '<button id="foo" class="bar" data-info="baz" disabled\n' +
            '        // missing foo\n' +
            '>Press me</button>'
        );
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
        }, 'to throw',
          'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button>\n' +
          'to only have attributes [ \'id\' ]\n' +
          '\n' +
          '<button id="foo" class="bar" // should be removed\n' +
          '        data-info="baz" // should be removed\n' +
          '        disabled // should be removed\n' +
          '>Press me</button>'
        );
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
        }, 'to throw',
          'expected <button class="bar" data-info="baz" disabled id="foo">Press me</button>\n' +
          'to have attributes [ \'id\', \'foo\' ]\n' +
          '\n' +
          '<button id="foo" class="bar" data-info="baz" disabled\n' +
          '        // missing foo\n' +
          '>Press me</button>'
        );
      });

      describe('with the absence of an attribute asserted by providing undefined as the expected value', function () {
        it('should succeed', function () {
          this.body.innerHTML = '<button id="foo">Press me</button>';
          expect(this.body.firstChild, 'to have attributes', { quux: undefined });
        });

        it('should fail with a diff', function () {
          this.body.innerHTML = '<button id="foo" quux="baz">Press me</button>';
          var el = this.body.firstChild;

          expect(function () {
            expect(el, 'to have attributes', { quux: undefined });
          }, 'to throw',
            'expected <button id="foo" quux="baz">Press me</button> to have attributes { quux: undefined }\n' +
            '\n' +
            '<button id="foo" quux="baz" // should be removed\n' +
            '>Press me</button>'
          );
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
        }, 'to throw', /^expected <button class="bar" data-info="baz" disabled id="foo">Press me<\/button>\nto only have attributes/);
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
        }, 'to throw', /expected <button class="bar" data-info="baz" disabled id="foo">Press me<\/button>\nto have attributes/);
      });

      describe('class attribute', function () {
        it('should match full class attributes', function () {
          this.body.innerHTML = '<i class="foo bar baz"></i>';

          expect(this.body.firstChild, 'to have attributes', {
            'class': 'foo bar baz'
          });
        });

        it('should throw on unmatched class set', function () {
          this.body.innerHTML = '<i class="bar"></i>';
          var el = this.body.firstChild;

          expect(function () {
            expect(el, 'to have attributes', {
              'class': 'foo bar baz'
            });
          }, 'to throw',
              'expected <i class="bar"></i> to have attributes { class: \'foo bar baz\' }\n' +
              '\n' +
              '<i class="bar" // expected [ \'bar\' ] to contain \'foo\', \'bar\', \'baz\'\n' +
              '></i>'
            );
        });

        it('should match partial class attributes', function () {
          this.body.innerHTML = '<i class="foo bar baz"></i>';

          expect(this.body.firstChild, 'to have attributes', {
            'class': 'foo bar'
          });
        });

        it('should match partial class attributes in different order', function () {
          this.body.innerHTML = '<i class="foo bar baz"></i>';

          expect(this.body.firstChild, 'to have attributes', {
            'class': 'baz foo'
          });
        });

        describe('exact matches', function () {
          it('should match an exact class set', function () {
            this.body.innerHTML = '<i class="foo bar baz"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              'class': 'foo bar baz'
            });
          });

          it('should match an exact class set in different order', function () {
            this.body.innerHTML = '<i class="foo bar baz"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              'class': 'foo baz bar'
            });
          });

          it('should throw if class set contains more classes than comparator', function () {
            this.body.innerHTML = '<i class="foo bar baz"></i>';
            var el = this.body.firstChild;

            expect(function () {
              expect(el, 'to only have attributes', {
                'class': 'foo baz'
              });
            }, 'to throw', /to only have attributes \{ class: 'foo baz' \}/);
          });

          it('should throw if class set contains less classes than comparator', function () {
            this.body.innerHTML = '<i class="foo baz"></i>';
            var el = this.body.firstChild;

            expect(function () {
              expect(el, 'to only have attributes', {
                'class': 'foo bar baz'
              });
            }, 'to throw', /to only have attributes \{ class: 'foo bar baz' \}/);
          });
        });
      });

      describe('style attribute', function () {
        describe('lax comparison', function () {
          it('should do string comparisons', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'color: red; background: blue'
            });
          });

          it('should do string comparisons in any order', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should do string comparisons on partial values', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'background: blue'
            });
          });

          it('should fail when styles are missing', function () {
            this.body.innerHTML = '<i style="color: red"></i>';
            var node = this.body.firstChild;

            expect(function () {
              expect(node, 'to have attributes', {
                style: 'background: blue'
              });
            }, 'to throw', /to have attributes \{ style: 'background: blue' \}/);
          });

          it('should do object comparisons', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: {
                color: 'red',
                background: 'blue'
              }
            });
          });

          it('should do partial object comparisons', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: {
                background: 'blue'
              }
            });
          });

          it('should fail on missing partial object comparisons', function () {
            this.body.innerHTML = '<i style="color: red"></i>';
            var node = this.body.firstChild;

            expect(function () {
              expect(node, 'to have attributes', {
                style: {
                  background: 'blue'
                }
              });
            }, 'to throw', /to have attributes \{ style: \{ background: 'blue' \} \}/);
          });

          it('should handle trailing semicolon', function () {
            this.body.innerHTML = '<div style="color: red;"></div>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: {
                color: 'red'
              }
            });
          });
        });

        describe('strict comparison', function () {
          it('should do string comparisons', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: 'color: red; background: blue'
            });
          });

          it('should do string comparisons in any order', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should fail when styles are missing', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';
            var node = this.body.firstChild;

            expect(function () {
              expect(node, 'to only have attributes', {
                style: 'background: blue'
              });
            }, 'to throw', /to only have attributes \{ style: 'background: blue' \}/);
          });

          it('should do object comparisons', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: {
                color: 'red',
                background: 'blue'
              }
            });
          });

          it('should fail on missing partial object comparisons', function () {
            this.body.innerHTML = '<i style="color: red; background: blue"></i>';
            var node = this.body.firstChild;

            expect(function () {
              expect(node, 'to only have attributes', {
                style: {
                  background: 'blue'
                }
              });
            }, 'to throw', /to only have attributes \{ style: \{ background: 'blue' \} \}/);
          });
        });
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

  describe('to satisfy', function () {
    it('should fail if an unsupported property is passed in the value', function () {
      body.innerHTML = '<div foo="bar"></div>';
      expect(function () {
        expect(body.firstChild, 'to satisfy', { foo: 'bar' });
      }, 'to throw', 'Unsupported option: foo');
    });

    describe('with a textContent property', function () {
        it('should succeed', function () {
            body.innerHTML = '<div foo="bar">foobarquux</div>';
            expect(body, 'to satisfy', { textContent: 'foobarquux' });
        });

        it('should fail', function () {
            body.innerHTML = '<div foo="bar">foobarquux</div>';

            expect(function () {
                expect(body, 'to satisfy', { textContent: 'fooquux' });
            }, 'to throw',
              'expected <body><div foo="bar">foobarquux</div></body> to satisfy { textContent: \'fooquux\' }\n' +
              '\n' +
              '<body>\n' +
              '  <div foo="bar">foobarquux</div> // expected \'foobarquux\' to equal \'fooquux\'\n' +
              '                                  //\n' +
              '                                  // -foobarquux\n' +
              '                                  // +fooquux\n' +
              '</body>'
          );
        });
    });

    describe('HTMLElement with a string as the value', function () {
      it('should succeed when the subject equals the value parsed as HTML', function () {
        return expect(parseHtml('<div foo="bar" baz="quux">hey</div>'), 'to satisfy', '<div foo="bar" baz="quux">hey</div>');
      });

      it('should fail when the subject has the wrong text content', function () {
        return expect(parseHtml('<div foo="bar" baz="quux">hey</div>'), 'to satisfy', '<div foo="bar" baz="quux">hey</div>');
      });

      it('should succeed when the subject equals the value parsed as HTML', function () {
        return expect(parseHtml('<div foo="bar" baz="quux">hey</div>'), 'to satisfy', '<div foo="bar">hey</div>');
      });

      it('should fail when the subject is missing an attribute', function () {
        return expect(function () {
          return expect(parseHtml('<div foo="bar">hey</div>'), 'to satisfy', '<div bar="quux">hey</div>');
        }, 'to error',
          'expected <div foo="bar">hey</div> to satisfy \'<div bar="quux">hey</div>\'\n' +
          '\n' +
          '<div foo="bar"\n' +
          '     // missing bar should equal \'quux\'\n' +
          '>hey</div>'
        );
      });

      it('should succeed when the subject has an extra class', function () {
        return expect(parseHtml('<div class="foo bar">hey</div>'), 'to satisfy', '<div class="bar">hey</div>');
      });

      it('should fail when the subject is missing a class', function () {
        return expect(function () {
          return expect(parseHtml('<div class="foo">hey</div>'), 'to satisfy', '<div class="bar">hey</div>');
        }, 'to error',
          'expected <div class="foo">hey</div> to satisfy \'<div class="bar">hey</div>\'\n' +
          '\n' +
          '<div class="foo" // expected [ \'foo\' ] to contain \'bar\'\n' +
          '>hey</div>'
        );
      });

      it('should succeed when the subject has an extra inline style', function () {
        return expect(parseHtml('<div style="color: tan; width: 120px;">hey</div>'), 'to satisfy', '<div style="color: tan;">hey</div>');
      });

      it('should fail when the subject is missing an inline style', function () {
        return expect(function () {
          return expect(parseHtml('<div style="width: 120px;">hey</div>'), 'to satisfy', '<div style="color: tan;">hey</div>');
        }, 'to error',
          'expected <div style="width: 120px">hey</div> to satisfy \'<div style="color: tan;">hey</div>\'\n' +
          '\n' +
          '<div style="width: 120px" // expected { width: \'120px\' } to satisfy { color: \'tan\' }\n' +
          '                          //\n' +
          '                          // {\n' +
          '                          //   width: \'120px\',\n' +
          '                          //   color: undefined // should equal \'tan\'\n' +
          '                          // }\n' +
          '>hey</div>'
        );
      });
    });

    describe('HTMLElement with a DOM element as the value', function () {
      it('should succeed when the subject equals the value parsed as HTML', function () {
        return expect(parseHtml('<div foo="bar" baz="quux">hey</div>'), 'to satisfy', parseHtml('<div foo="bar" baz="quux">hey</div>'));
      });

      it('should fail when the subject has the wrong text content', function () {
        return expect(parseHtml('<div foo="bar" baz="quux">hey</div>'), 'to satisfy', parseHtml('<div foo="bar" baz="quux">hey</div>'));
      });

      it('should succeed when the subject equals the value parsed as HTML', function () {
        return expect(parseHtml('<div foo="bar" baz="quux">hey</div>'), 'to satisfy', parseHtml('<div foo="bar">hey</div>'));
      });

      it('should fail when the subject is missing an attribute', function () {
        return expect(function () {
          return expect(parseHtml('<div foo="bar">hey</div>'), 'to satisfy', parseHtml('<div bar="quux">hey</div>'));
        }, 'to error',
            'expected <div foo="bar">hey</div> to satisfy <div bar="quux">hey</div>\n' +
            '\n' +
            '<div foo="bar"\n' +
            '     // missing bar should equal \'quux\'\n' +
            '>hey</div>'
        );
      });

      it('should succeed when the subject has an extra class', function () {
        return expect(parseHtml('<div class="foo bar">hey</div>'), 'to satisfy', parseHtml('<div class="bar">hey</div>'));
      });

      it('should fail when the subject is missing a class', function () {
        return expect(function () {
          return expect(parseHtml('<div class="foo">hey</div>'), 'to satisfy', parseHtml('<div class="bar">hey</div>'));
        }, 'to error',
          'expected <div class="foo">hey</div> to satisfy <div class="bar">hey</div>\n' +
          '\n' +
          '<div class="foo" // expected [ \'foo\' ] to contain \'bar\'\n' +
          '>hey</div>'
        );
      });

      it('should succeed when the subject has an extra inline style', function () {
        return expect(parseHtml('<div style="color: tan; width: 120px;">hey</div>'), 'to satisfy', parseHtml('<div style="color: tan;">hey</div>'));
      });

      it('should fail when the subject is missing an inline style', function () {
        return expect(function () {
          return expect(parseHtml('<div style="width: 120px;">hey</div>'), 'to satisfy', parseHtml('<div style="color: tan;">hey</div>'));
        }, 'to error',
          'expected <div style="width: 120px">hey</div> to satisfy <div style="color: tan">hey</div>\n' +
          '\n' +
          '<div style=\"width: 120px\" // expected { width: \'120px\' } to satisfy { color: \'tan\' }\n' +
          '                          //\n' +
          '                          // {\n' +
          '                          //   width: \'120px\',\n' +
          '                          //   color: undefined // should equal \'tan\'\n' +
          '                          // }\n' +
          '>hey</div>'
        );
      });
    });

    describe('text node with a text node as the value', function () {
      it('should succeed', function () {
        expect(parseHtml('foobar'), 'to satisfy', parseHtml('foobar'));
      });

      it('should fail with a diff', function () {
        expect(function () {
          expect(parseHtml('foobar'), 'to satisfy', parseHtml('bar'));
        }, 'to error',
          'expected foobar to satisfy bar\n' +
          '\n' +
          '-foobar\n' +
          '+bar'
        );
      });
    });

    describe('with a name assertion', function () {
      it('should succeed', function () {
        body.innerHTML = '<div foo="bar"></div>';
        expect(body.firstChild, 'to satisfy', { name: /^d/ });
      });

      it('should fail with a diff', function () {
        body.innerHTML = '<div foo="bar"></div>';
        expect(function () {
          expect(body.firstChild, 'to satisfy', { name: /^sp/ });
        }, 'to throw',
          'expected <div foo="bar"></div> to satisfy { name: /^sp/ }\n' +
          '\n' +
          '<div // should match /^sp/\n' +
          '     foo="bar"></div>'
        );
      });

      describe('in an XML document with a mixed case node name', function () {
        var xmlDoc = jsdom.jsdom('<?xml version="1.0"?><fooBar hey="there"></fooBar>', { parsingMode: 'xml' });

        it('should succeed', function () {
          expect(xmlDoc.firstChild, 'to satisfy', { name: 'fooBar' });
        });

        it('should fail with a diff', function () {
          expect(function () {
            expect(xmlDoc.firstChild, 'to satisfy', { name: 'fooBarQuux' });
          }, 'to throw',
            'expected <fooBar hey="there"></fooBar> to satisfy { name: \'fooBarQuux\' }\n' +
            '\n' +
            '<fooBar // should equal \'fooBarQuux\'\n' +
            '        hey="there"></fooBar>'
          );
        });
      });
    });

    describe('with a children assertion', function () {
      it('should succeed', function () {
        body.innerHTML = '<div foo="bar">hey</div>';
        expect(body.firstChild, 'to satisfy', { children: [ 'hey' ] });
      });

      it('should fail with a diff', function () {
        body.innerHTML = '<div foo="bar">hey</div>';
        expect(function () {
          expect(body.firstChild, 'to satisfy', { children: [ 'there' ] });
        }, 'to throw',
          'expected <div foo="bar">hey</div> to satisfy { children: [ \'there\' ] }\n' +
          '\n' +
          '<div foo="bar">\n' +
          '  hey // should equal \'there\'\n' +
          '      // -hey\n' +
          '      // +there\n' +
          '</div>'
        );
      });
    });

    it('should fail with a diff', function () {
      body.innerHTML = '<div foo="bar" id="quux">foobar</div><div foo="quux">hey</div>';
      expect(function () {
        expect(body, 'queried for', 'div', 'to satisfy', {
          1: { attributes: { foo: 'bar' } }
        });
      }, 'to throw',
        'expected\n' +
        '<body>\n' +
        '  <div foo="bar" id="quux">foobar</div>\n' +
        '  <div foo="quux">hey</div>\n' +
        '</body>\n' +
        'queried for \'div\' to satisfy { 1: { attributes: { foo: \'bar\' } } }\n' +
        '  expected NodeList[ <div foo="bar" id="quux">foobar</div>, <div foo="quux">hey</div> ]\n' +
        '  to satisfy { 1: { attributes: { foo: \'bar\' } } }\n' +
        '\n' +
        '  NodeList[\n' +
        '    <div foo="bar" id="quux">...</div>,\n' +
        '    <div foo="quux" // expected \'quux\' to equal \'bar\'\n' +
        '                    //\n' +
        '                    // -quux\n' +
        '                    // +bar\n' +
        '    >hey</div>\n' +
        '  ]'
      );
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
      }, 'to throw',
          'expected <body><div id="foo"></div></body>\n' +
          'queried for first \'.blabla\', \'to have attributes\', { id: \'foo\' }\n' +
          '  The selector .blabla yielded no results'
      );
    });

    it('should error out if the selector matches no elements, first flag not set', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div id="foo"></div></body></html>');
      expect(function () {
        expect(document.body, 'queried for', '.blabla', 'to have attributes', { id: 'foo' });
      }, 'to throw',
          'expected <body><div id="foo"></div></body> queried for \'.blabla\', \'to have attributes\', { id: \'foo\' }\n' +
          '  The selector .blabla yielded no results'
      );
    });

    it('should return an array-like NodeList', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div></div><div></div><div></div></body></html>');

      expect(document, 'queried for', 'div', 'to be a', 'DOMNodeList');
    });

    it('should be able to use array semantics', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div></div><div></div><div></div></body></html>');

      expect(document, 'queried for', 'div', 'to have length', 3);
    });

    it('should fail array checks with useful nested error message', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><head></head><body><div></div><div></div><div></div></body></html>');

      expect(function () {
        expect(document, 'queried for', 'div', 'to have length', 1);
      }, 'to throw',
          'expected <!DOCTYPE html><html><head></head><body>...</body></html> queried for \'div\' to have length 1\n' +
          '  expected NodeList[ <div></div>, <div></div>, <div></div> ] to have length 1\n' +
          '    expected 3 to be 1'
      );
    });
  });

  describe('to contain no elements matching', function () {
    it('should pass when not matching anything', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body></body></html>');

      expect(document, 'to contain no elements matching', '.foo');
    });

    it('should fail when matching a single node', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div></body></html>');

      expect(function () {
        expect(document, 'to contain no elements matching', '.foo');
      }, 'to throw',
          'expected <!DOCTYPE html><html><head></head><body>...</body></html>\n' +
          'to contain no elements matching \'.foo\'\n' +
          '\n' +
          'NodeList[\n' +
          '  <div class="foo"></div> // should be removed\n' +
          ']'
      );
    });

    it('should fail when matching a NodeList', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>');

      expect(function () {
        expect(document, 'to contain no elements matching', '.foo');
      }, 'to throw',
          'expected <!DOCTYPE html><html><head></head><body>...</body></html>\n' +
          'to contain no elements matching \'.foo\'\n' +
          '\n' +
          'NodeList[\n' +
          '  <div class="foo"></div>, // should be removed\n' +
          '  <div class="foo"></div> // should be removed\n' +
          ']'
      );
    });
  });

  describe('to contain elements matching', function () {
    it('should pass when matching an element', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div></body></html>');

      expect(document, 'to contain elements matching', '.foo');
    });

    it('should fail when no elements match', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>');

      expect(function () {
          expect(document, 'to contain elements matching', '.bar');
        }, 'to throw', 'expected <!DOCTYPE html><html><head></head><body>...</body></html> to contain elements matching \'.bar\'');
    });
  });

  describe('to match', function () {
    it('should match an element correctly', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div></body></html>');

      expect(document.body.firstChild, 'to match', '.foo');
    });

    it('should fail on matching element with a non-matching selector', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div></body></html>');

      expect(function () {
        expect(document.body.firstChild, 'to match', '.bar');
      }, 'to throw', 'expected <div class="foo"></div> to match \'.bar\'');
    });

    it('should not match an element that doesn\'t match the selector', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div></body></html>');

      expect(document.body.firstChild, 'not to match', '.bar');
    });

    it('should fail when matching with a selector that was not expected to match', function () {
      var document = jsdom.jsdom('<!DOCTYPE html><html><body><div class="foo"></div></body></html>');

      expect(function () {
        expect(document.body.firstChild, 'not to match', '.foo');
      }, 'to throw', 'expected <div class="foo"></div> not to match \'.foo\'');
    });
  });

  describe('diffing', function () {
    expect.addAssertion(['string', 'DOMNode'], 'diffed with', function (expect, subject, value) {
      if (typeof subject === 'string') {
        subject = parseHtml(subject);
      }
      if (typeof value === 'string') {
        value = parseHtml(value);
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
        '  <div id="bar" // should equal \'quux\'\n' +
        '  ></div>\n' +
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
        '  <span id="foo" // should be removed\n' +
        '        class="bar" // should be removed\n' +
        '  >\n' +
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
        jsdom.jsdom('<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->'),
        'diffed with',
        jsdom.jsdom('<!DOCTYPE html><html><head></head><body></body></html>'),
        'to equal',
            '<!DOCTYPE html>\n' +
            '<!--foo--> // should be removed\n' +
            '<html><head></head><body></body></html>\n' +
            '<!--bar--> // should be removed'
        );
    });
  });

  describe('when parsed as HTML', function () {
    var htmlSrc = '<!DOCTYPE html><html><body class="bar">foo</body></html>';
    it('should parse a string as a complete HTML document', function () {
      expect(htmlSrc, 'when parsed as HTML',
          expect.it('to be an', 'HTMLDocument')
            .and('to equal', jsdom.jsdom(htmlSrc))
            .and('queried for first', 'body', 'to have attributes', { class: 'bar' })
      );
    });

    describe('with the "fragment" flag', function () {
      it('should return a DocumentFragment instance', function () {
        expect('<div>foo</div><div>bar</div>', 'when parsed as HTML fragment', 'to satisfy',
          expect.it('to be a', 'DOMDocumentFragment')
            .and('to satisfy', {
              children: [
                { name: 'div', children: [ 'foo' ] },
                { name: 'div', children: [ 'bar' ] }
              ]
            }
          )
        );
      });
    });

    it('should fail when the next assertion fails', function () {
      expect(function () {
        expect(htmlSrc, 'when parsed as HTML', 'queried for first', 'body', 'to have attributes', { class: 'quux' });
      }, 'to throw',
        'expected \'<!DOCTYPE html><html><body class="bar">foo</body></html>\'\n' +
        'when parsed as HTML queried for first \'body\', \'to have attributes\', { class: \'quux\' }\n' +
        '  expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>\n' +
        '  queried for first \'body\' to have attributes { class: \'quux\' }\n' +
        '    expected <body class="bar">foo</body> to have attributes { class: \'quux\' }\n' +
        '\n' +
        '    <body class="bar" // expected [ \'bar\' ] to contain \'quux\'\n' +
        '    >foo</body>'
      );
    });


    describe('when the DOMParser global is available', function () {
      var originalDOMParser,
          DOMParserSpy,
          parseFromStringSpy;

      beforeEach(function () {
        originalDOMParser = global.DOMParser;
        global.DOMParser = DOMParserSpy = sinon.spy(function () {
          return {
            parseFromString: parseFromStringSpy = sinon.spy(function (htmlString, contentType) {
              return jsdom.jsdom(htmlString);
            })
          };
        });
      });
      afterEach(function () {
        global.DOMParser = originalDOMParser;
      });

      it('should use DOMParser to parse the document', function () {
        expect(htmlSrc, 'when parsed as HTML', 'queried for first', 'body', 'to have text', 'foo');
        expect(DOMParserSpy, 'was called once');
        expect(DOMParserSpy, 'was called with');
        expect(DOMParserSpy.calledWithNew(), 'to be true');
        expect(parseFromStringSpy, 'was called once');
        expect(parseFromStringSpy, 'was called with', htmlSrc, 'text/html');
      });
    });

    describe('when the document global is available', function () {
      var originalDocument,
          createHTMLDocumentSpy,
          mockDocument;

      beforeEach(function () {
        originalDocument = global.document;
        global.document = {
          implementation: {
            createHTMLDocument: createHTMLDocumentSpy = sinon.spy(function () {
              mockDocument = jsdom.jsdom(htmlSrc);
              mockDocument.open = sinon.spy();
              mockDocument.write = sinon.spy();
              mockDocument.close = sinon.spy();
              return mockDocument;
            })
          }
        };
      });
      afterEach(function () {
        global.document = originalDocument;
      });

      it('should use document.implementation.createHTMLDocument to parse the document', function () {
        expect(htmlSrc, 'when parsed as HTML', 'queried for first', 'body', 'to have text', 'foo');
        expect(createHTMLDocumentSpy, 'was called once');
        expect(createHTMLDocumentSpy, 'was called with');
        expect(mockDocument.open, 'was called once');
        expect(mockDocument.write, 'was called with');
        expect(mockDocument.write, 'was called once');
        expect(mockDocument.write, 'was called with', htmlSrc);
        expect(mockDocument.close, 'was called once');
        expect(mockDocument.write, 'was called with');
        expect([mockDocument.open, mockDocument.write, mockDocument.close], 'given call order');
      });
    });
  });

  describe('when parsed as XML', function () {
    var xmlSrc = '<?xml version="1.0"?><fooBar yes="sir">foo</fooBar>';
    it('should parse a string as a complete XML document', function () {
      expect(xmlSrc, 'when parsed as XML',
          expect.it('to be an', 'XMLDocument')
            .and('to equal', jsdom.jsdom(xmlSrc, { parsingMode: 'xml' }))
            .and('queried for first', 'fooBar', 'to have attributes', { yes: 'sir' })
      );
    });

    describe('when the DOMParser global is available', function () {
      var originalDOMParser,
          DOMParserSpy,
          parseFromStringSpy;

      beforeEach(function () {
        originalDOMParser = global.DOMParser;
        global.DOMParser = DOMParserSpy = sinon.spy(function () {
          return {
            parseFromString: parseFromStringSpy = sinon.spy(function (xmlString, contentType) {
              return jsdom.jsdom(xmlString, { parsingMode: 'xml' });
            })
          };
        });
      });
      afterEach(function () {
        global.DOMParser = originalDOMParser;
      });

      it('should use DOMParser to parse the document', function () {
        expect(xmlSrc, 'when parsed as XML', 'queried for first', 'fooBar', 'to have text', 'foo');
        expect(DOMParserSpy, 'was called once');
        expect(DOMParserSpy, 'was called with');
        expect(DOMParserSpy.calledWithNew(), 'to be true');
        expect(parseFromStringSpy, 'was called once');
        expect(parseFromStringSpy, 'was called with', xmlSrc, 'text/xml');
      });
    });
  });

  it('should render the floating menu correctly', function () {
    body.innerHTML =
      '<ul class="knockout-autocomplete menu scrollable floating-menu" style="display: block; bottom: auto; top: 0px; left: 0px">' +
      '<li class="selected" data-index="0">' +
      '<span class="before"></span>' +
      '<strong class="match">pr</strong>' +
      '<span class="after">ivate</span>' +
      '</li>' +
      '<li data-index="1">' +
      '<span class="before"></span>' +
      '<strong class="match">pr</strong>' +
      '<span class="after">otected</span>' +
      '</li>' +
      '</ul>';

    expect(function () {
      expect(body.firstChild, 'to satisfy', {
          attributes: {
              style: { display: 'block' },
              'class': ['knockout-autocomplete', 'floating-menu']
          },
          children: [
              {
                  attributes:  { 'data-index': '0', 'class': 'selected' },
                  children: [
                      { attributes: { 'class': 'before' }, children: [] },
                      { attributes: { 'class': 'match' }, children: ['pr']  },
                      { attributes: { 'class': 'after' }, children: ['ivate'] }
                  ]
              },
              {
                  attributes:  { 'data-index': '1', 'class': undefined },
                  children: [
                      { attributes: { 'class': 'before' }, children: [] },
                      { attributes: { 'class': 'match' }, children: ['pr']  },
                      { attributes: { 'class': 'after' }, children: ['odtected'] }
                  ]
              }
          ]
      });
    }, 'to throw',
      'expected\n' +
      '<ul class="knockout-autocomplete menu scrollable floating-menu" style="display: block; bottom: auto; top: 0px; left: 0px">\n' +
      '  <li class="selected" data-index="0">\n' +
      '    <span class="before"></span>\n' +
      '    <strong class="match">...</strong>\n' +
      '    <span class="after">...</span>\n' +
      '  </li>\n' +
      '  <li data-index="1">\n' +
      '    <span class="before"></span>\n' +
      '    <strong class="match">...</strong>\n' +
      '    <span class="after">...</span>\n' +
      '  </li>\n' +
      '</ul>\n' +
      'to satisfy\n' +
      '{\n' +
      '  attributes: { style: { display: \'block\' }, class: [...] },\n' +
      '  children: [ { attributes: ..., children: ... }, { attributes: ..., children: ... } ]\n' +
      '}\n' +
      '\n' +
      '<ul class="knockout-autocomplete menu scrollable floating-menu" style="display: block; bottom: auto; top: 0px; left: 0px">\n' +
      '  <li class="selected" data-index="0">...</li>\n' +
      '  <li data-index="1">\n' +
      '    <span class="before"></span>\n' +
      '    <strong class="match">...</strong>\n' +
      '    <span class="after">\n' +
      '      otected // should equal \'odtected\'\n' +
      '              // -otected\n' +
      '              // +odtected\n' +
      '    </span>\n' +
      '  </li>\n' +
      '</ul>'
    );
  });
});
