/*global expect, jsdom, sinon, describe, it, beforeEach, afterEach, DOMParser:true*/
expect.addAssertion(
  '<any> to inspect as <string>',
  (expect, subject, value) => {
    if (typeof subject === 'string') {
      subject = parseHtml(subject);
    }
    expect(expect.inspect(subject).toString(), 'to equal', value);
  }
);

expect.addAssertion('<any> to inspect as itself', (expect, subject) => {
  if (typeof subject === 'string') {
    expect(subject, 'to inspect as', subject);
  } else {
    throw new Error(
      'subject must be given as a string when expected to inspect as itself'
    );
  }
});

expect.addAssertion(
  '<array> to produce a diff of <string>',
  (expect, subject, value) => {
    expect.errorMode = 'bubble';
    subject = subject.map(item =>
      typeof item === 'string' ? parseHtml(item) : item
    );
    expect(expect.diff(subject[0], subject[1]).toString(), 'to equal', value);
  }
);

const root = typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
const parseHtmlDocument =
  typeof jsdom !== 'undefined'
    ? str => new jsdom.JSDOM(str).window.document
    : str => new DOMParser().parseFromString(str, 'text/html');

function parseHtml(str) {
  return parseHtmlDocument(`<!DOCTYPE html><html><body>${str}</body></html>`)
    .body.firstChild;
}

function parseHtmlFragment(str) {
  const htmlDocument = parseHtmlDocument(
    `<html><head></head><body>${str}</body></html>`
  );
  const body = htmlDocument.body;
  const documentFragment = htmlDocument.createDocumentFragment();
  if (body) {
    for (let i = 0; i < body.childNodes.length; i += 1) {
      documentFragment.appendChild(body.childNodes[i].cloneNode(true));
    }
  }
  return documentFragment;
}

function parseHtmlNode(str) {
  return parseHtmlFragment(str).childNodes[0];
}

function parseXml(str) {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(str, 'application/xml');
  } else {
    return new jsdom.JSDOM(str, { contentType: 'text/xml' }).window.document;
  }
}

describe('unexpected-dom', () => {
  expect.output.preferredWidth = 100;

  let theDocument;
  let body;
  beforeEach(function() {
    theDocument = root.document;
    body = theDocument.body;
    // FIXME: defined for compatibility
    this.body = body;
  });

  it('should inspect an HTML document correctly', () => {
    expect(
      '<!DOCTYPE html><html><head></head><BODY></BODY></html>',
      'when parsed as HTML',
      'to inspect as',
      '<!DOCTYPE html><html><head></head><body></body></html>'
    );
  });

  it('should inspect an XML document correctly', () => {
    expect(
      '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>',
      'when parsed as XML',
      'to inspect as',
      '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>'
    );
  });

  it('should inspect a document with nodes around the documentElement correctly', () => {
    expect(
      '<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->',
      'when parsed as HTML',
      'to inspect as',
      '<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->'
    );
  });

  it('should inspect an attribute-less element correctly', () => {
    expect('<div></div>', 'to inspect as itself');
  });

  it('should dot out descendants at level >= 3 when inspecting', () => {
    expect(
      '<div><div><div><div>foo</div></div></div></div>',
      'to inspect as',
      '<div><div><div>...</div></div></div>'
    );
  });

  it('should inspect void elements correctly', () => {
    expect('<input type="text">', 'to inspect as itself');
  });

  it('should inspect simple attributes correctly', () => {
    expect('<input disabled type="text">', 'to inspect as itself');
  });

  it('should inspect undefined attributes correctly', () => {
    expect('<input value="">', 'to inspect as itself');
  });

  describe('diffing', () => {
    it('should diff elements with different node names', () => {
      expect(
        ['<div></div>', '<span></span>'],
        'to produce a diff of',
        '<div // should be span\n></div>'
      );
    });

    it('should diff a mismatching attribute', () => {
      expect(
        ['<div id="foo"></div>', '<div id="bar"></div>'],
        'to produce a diff of',
        '<div id="foo" // should equal \'bar\'\n></div>'
      );
    });

    it('should diff a mismatching attribute with a char that needs entitification', () => {
      expect(
        ['<div id="foo&quot;bar"></div>', '<div id="quux&quot;baz"></div>'],
        'to produce a diff of',
        '<div id="foo&quot;bar" // should equal \'quux&quot;baz\'\n></div>'
      );
    });

    it('should diff multiple mismatching attributes', () => {
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

    it('should diff an extraneous attribute', () => {
      expect(
        ['<div id="foo"></div>', '<div></div>'],
        'to produce a diff of',
        '<div id="foo" // should be removed\n></div>'
      );
    });

    it('should diff a missing attribute', () => {
      expect(
        ['<div></div>', '<div id="foo"></div>'],
        'to produce a diff of',
        '<div // missing id="foo"\n></div>'
      );
    });

    it('should diff a missing attribute with a char that needs entitification', () => {
      expect(
        ['<div></div>', '<div id="fo&amp;o"></div>'],
        'to produce a diff of',
        '<div // missing id="fo&amp;o"\n></div>'
      );
    });

    it('should diff a child node', () => {
      expect(
        ['<div>foo</div>', '<div>bar</div>'],
        'to produce a diff of',
        '<div>\n' + '  -foo\n' + '  +bar\n' + '</div>'
      );
    });

    describe('with DOMDocuments', () => {
      describe('satisfied against other DOMDocument instances', () => {
        it('should succeed', () => {
          expect(
            '<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>',
            'when parsed as HTML to satisfy',
            parseHtmlDocument(
              '<!DOCTYPE html><html><head></head><body>foo</body></html>'
            )
          );
        });

        it('should fail with a diff', () => {
          expect(
            () => {
              expect(
                '<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>',
                'when parsed as HTML to satisfy',
                parseHtmlDocument(
                  '<!DOCTYPE html><html><body class="foo"></body></html>'
                )
              );
            },
            'to throw',
            'expected \'<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>\'\n' +
              'when parsed as HTML to satisfy <!DOCTYPE html><html><head></head><body class="foo"></body></html>\n' +
              '  expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>\n' +
              '  to satisfy <!DOCTYPE html><html><head></head><body class="foo"></body></html>\n' +
              '\n' +
              '  <!DOCTYPE html>\n' +
              '  <html>\n' +
              '    <head></head>\n' +
              '    <body\n' +
              "      class=\"bar\" // expected [ 'bar' ] to contain 'foo'\n" +
              '    >\n' +
              '      foo // should be removed\n' +
              '    </body>\n' +
              '  </html>'
          );
        });
      });

      describe('satisfied against a string', () => {
        it('should succeed', () => {
          expect(
            '<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>',
            'when parsed as HTML to satisfy',
            '<!DOCTYPE html><html><head></head><body>foo</body></html>'
          );
        });

        it('should fail with a diff', () => {
          expect(
            () => {
              expect(
                '<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>',
                'when parsed as HTML to satisfy',
                '<!DOCTYPE html><html><head></head><body class="foo"></body></html>'
              );
            },
            'to throw',
            'expected \'<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>\'\n' +
              'when parsed as HTML to satisfy \'<!DOCTYPE html><html><head></head><body class="foo"></body></html>\'\n' +
              '  expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>\n' +
              '  to satisfy \'<!DOCTYPE html><html><head></head><body class="foo"></body></html>\'\n' +
              '\n' +
              '  <!DOCTYPE html>\n' +
              '  <html>\n' +
              '    <head></head>\n' +
              '    <body\n' +
              "      class=\"bar\" // expected [ 'bar' ] to contain 'foo'\n" +
              '    >\n' +
              '      foo // should be removed\n' +
              '    </body>\n' +
              '  </html>'
          );
        });
      });
    });

    describe('with DOMDocumentFragments', () => {
      it('should diff fragments consisting of single nodes', () => {
        expect(
          ['<div>foo</div>', '<div>bar</div>'].map(parseHtmlFragment),
          'to produce a diff of',
          '<div>\n' + '  -foo\n' + '  +bar\n' + '</div>'
        );
      });

      it('should diff fragments consisting of multiple nodes', () => {
        expect(
          [
            '<div>foo</div><div>bar</div>',
            '<div>foo<i>blah</i></div><span>bark</span>'
          ].map(parseHtmlFragment),
          'to produce a diff of',
          '<div>\n' +
            '  foo\n' +
            '  // missing <i>blah</i>\n' +
            '</div>\n' +
            '<div // should be span\n' +
            '>\n' +
            '  -bar\n' +
            '  +bark\n' +
            '</div>'
        );
      });
    });
  });

  it('should allow regular assertions defined for the object type to work on an HTMLElement', () => {
    expect(
      parseHtmlDocument('<html><head></head><body></body></html>').firstChild,
      'to have properties',
      { nodeType: 1 }
    );
  });

  it('should consider two DOM elements equal when they are of same type and have same attributes', () => {
    const el1 = theDocument.createElement('h1');
    const el2 = theDocument.createElement('h1');
    const el3 = theDocument.createElement('h1');
    el3.id = 'el3';
    const paragraph = theDocument.createElement('p');

    expect(el1, 'to be', el1);
    expect(el1, 'not to be', el2);
    expect(el1, 'to equal', el2);
    expect(el1, 'not to equal', el3);
    expect(el1, 'not to equal', paragraph);
  });

  describe('to have text', () => {
    it('should succeed', () => {
      theDocument.body.innerHTML = '<div>foo</div>';
      return expect(theDocument.body, 'to have text', 'foo');
    });

    it('should fail with a diff', () => {
      theDocument.body.innerHTML = '<div>foo</div>';
      expect(
        () => {
          expect(theDocument.body, 'to have text', 'bar');
        },
        'to throw',
        "expected <body><div>foo</div></body> to have text 'bar'\n" +
          '\n' +
          '-foo\n' +
          '+bar'
      );
    });

    it('should use "to satisfy" semantics', () => {
      theDocument.body.innerHTML = '<div>foo</div>';
      return expect(theDocument.body, 'to have text', /fo/);
    });
  });

  describe('to have class', () => {
    it('should handle a non-existing class', () => {
      body.innerHTML = '<button>Press me</button>';

      expect(
        () => {
          expect(body.firstChild, 'to have class', 'foo');
        },
        'to throw',
        "expected <button>Press me</button> to have class 'foo'\n" +
          '\n' +
          '<button\n' +
          "  // missing class should satisfy 'foo'\n" +
          '>Press me</button>'
      );
    });

    describe('with a single class passed as a string', () => {
      it('should succeed', () => {
        body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        expect(body.firstChild, 'to have class', 'bar');
      });

      it('should fail with a diff', () => {
        body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'to have class', 'quux');
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to have class 'quux'\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            "  class=\"bar\" // expected [ 'bar' ] to contain 'quux'\n" +
            '  data-info="baz"\n' +
            '  disabled\n' +
            '>Press me</button>'
        );
      });
    });

    describe('with multiple classes passed as an array', () => {
      it('should succeed', () => {
        body.innerHTML =
          '<button id="foo" class="bar foo" data-info="baz" disabled>Press me</button>';
        expect(body.firstChild, 'to have classes', ['foo', 'bar']);
      });

      it('should fail with a diff', () => {
        body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'to have classes', ['quux', 'bar']);
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to have classes [ 'quux', 'bar' ]\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            "  class=\"bar\" // expected [ 'bar' ] to contain 'quux', 'bar'\n" +
            '  data-info="baz"\n' +
            '  disabled\n' +
            '>Press me</button>'
        );
      });
    });

    describe('with the "only" flag', () => {
      describe('with a single class passed as a string', () => {
        it('should succeed', () => {
          body.innerHTML =
            '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
          expect(body.firstChild, 'to only have class', 'bar');
        });

        it('should fail with a diff', () => {
          body.innerHTML =
            '<button id="foo" class="bar quux" data-info="baz" disabled>Press me</button>';
          expect(
            () => {
              expect(body.firstChild, 'to only have class', 'quux');
            },
            'to throw',
            'expected\n' +
              '<button class="bar quux" data-info="baz" disabled id="foo">\n' +
              '  Press me\n' +
              '</button>\n' +
              "to only have class 'quux'\n" +
              '\n' +
              '<button\n' +
              '  id="foo"\n' +
              "  class=\"bar quux\" // expected [ 'bar', 'quux' ] to equal [ 'quux' ]\n" +
              '                   //\n' +
              '                   // [\n' +
              "                   //   'bar', // should be removed\n" +
              "                   //   'quux'\n" +
              '                   // ]\n' +
              '  data-info="baz"\n' +
              '  disabled\n' +
              '>Press me</button>'
          );
        });
      });

      describe('with multiple classes passed as an array', () => {
        it('should succeed', () => {
          body.innerHTML =
            '<button id="foo" class="bar foo" data-info="baz" disabled>Press me</button>';
          expect(body.firstChild, 'to only have classes', ['foo', 'bar']);
        });

        it('should fail with a diff', () => {
          body.innerHTML =
            '<button id="foo" class="bar quux foo" data-info="baz" disabled>Press me</button>';
          expect(
            () => {
              expect(body.firstChild, 'to only have classes', ['quux', 'bar']);
            },
            'to throw',
            'expected\n' +
              '<button class="bar quux foo" data-info="baz" disabled id="foo">\n' +
              '  Press me\n' +
              '</button>\n' +
              "to only have classes [ 'bar', 'quux' ]\n" +
              '\n' +
              '<button\n' +
              '  id="foo"\n' +
              "  class=\"bar quux foo\" // expected [ 'bar', 'foo', 'quux' ] to equal [ 'bar', 'quux' ]\n" +
              '                       //\n' +
              '                       // [\n' +
              "                       //   'bar',\n" +
              "                       //   'foo', // should be removed\n" +
              "                       //   'quux'\n" +
              '                       // ]\n' +
              '  data-info="baz"\n' +
              '  disabled\n' +
              '>Press me</button>'
          );
        });
      });
    });
  });

  describe('to have attributes', () => {
    describe('argument comparison', () => {
      it('should match exact arguments', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(
          this.body.firstChild,
          'to only have attributes',
          'id',
          'class',
          'data-info',
          'disabled'
        );
      });

      it('should fail on exact arguments not met', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to only have attributes', 'id');
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to only have attributes 'id'\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            '  class="bar" // should be removed\n' +
            '  data-info="baz" // should be removed\n' +
            '  disabled // should be removed\n' +
            '>Press me</button>'
        );
      });

      it('should match partial arguments', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" style="color: #b4d455" disabled>Press me</button>';

        expect(
          this.body.firstChild,
          'to have attributes',
          'id',
          'class',
          'style'
        );
      });

      it('should fail on partial arguments not met', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', 'id', 'foo');
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to have attributes 'id', 'foo'\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            '  class="bar"\n' +
            '  data-info="baz"\n' +
            '  disabled\n' +
            '  // missing foo\n' +
            '>Press me</button>'
        );
      });
    });

    describe('array comparison', () => {
      it('should match exact arguments', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', [
          'id',
          'class',
          'data-info',
          'disabled'
        ]);
      });

      it('should fail on exact arguments not met', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to only have attributes', ['id']);
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to only have attributes [ 'id' ]\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            '  class="bar" // should be removed\n' +
            '  data-info="baz" // should be removed\n' +
            '  disabled // should be removed\n' +
            '>Press me</button>'
        );
      });

      it('should match partial arguments', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to have attributes', ['id', 'class']);
      });

      it('should fail on partial arguments not met', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', ['id', 'foo']);
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to have attributes [ 'id', 'foo' ]\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            '  class="bar"\n' +
            '  data-info="baz"\n' +
            '  disabled\n' +
            '  // missing foo\n' +
            '>Press me</button>'
        );
      });

      describe('with the absence of an attribute asserted by providing undefined as the expected value', () => {
        it('should succeed', function() {
          this.body.innerHTML = '<button id="foo">Press me</button>';
          expect(this.body.firstChild, 'to have attributes', {
            quux: undefined
          });
        });

        it('should fail with a diff', function() {
          this.body.innerHTML = '<button id="foo" quux="baz">Press me</button>';
          const el = this.body.firstChild;

          expect(
            () => {
              expect(el, 'to have attributes', { quux: undefined });
            },
            'to throw',
            'expected <button id="foo" quux="baz">Press me</button> to have attributes { quux: undefined }\n' +
              '\n' +
              '<button\n' +
              '  id="foo"\n' +
              '  quux="baz" // should be removed\n' +
              '>Press me</button>'
          );
        });
      });
    });

    describe('object comparison', () => {
      it('should match exact object', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', {
          id: 'foo',
          class: 'bar',
          'data-info': 'baz',
          disabled: true
        });
      });

      it('should fail on exact object not satisfied', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to only have attributes', {
              id: 'foo'
            });
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to only have attributes { id: 'foo' }\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            '  class="bar" // should be removed\n' +
            '  data-info="baz" // should be removed\n' +
            '  disabled // should be removed\n' +
            '>Press me</button>'
        );
      });

      it('should match partial object', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to have attributes', {
          id: 'foo',
          class: 'bar'
        });
      });

      it('should fail on partial object not satisfied', function() {
        this.body.innerHTML =
          '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', {
              id: 'foo',
              foo: 'bar'
            });
          },
          'to throw',
          'expected\n' +
            '<button class="bar" data-info="baz" disabled id="foo">\n' +
            '  Press me\n' +
            '</button>\n' +
            "to have attributes { id: 'foo', foo: 'bar' }\n" +
            '\n' +
            '<button\n' +
            '  id="foo"\n' +
            '  class="bar"\n' +
            '  data-info="baz"\n' +
            '  disabled\n' +
            "  // missing foo should equal 'bar'\n" +
            '>Press me</button>'
        );
      });

      describe('class attribute', () => {
        it('should match full class attributes', function() {
          this.body.innerHTML = '<i class="foo bar baz"></i>';

          expect(this.body.firstChild, 'to have attributes', {
            class: 'foo bar baz'
          });
        });

        it('should throw on unmatched class set', function() {
          this.body.innerHTML = '<i class="bar"></i>';
          const el = this.body.firstChild;

          expect(
            () => {
              expect(el, 'to have attributes', {
                class: 'foo bar baz'
              });
            },
            'to throw',
            'expected <i class="bar"></i> to have attributes { class: \'foo bar baz\' }\n' +
              '\n' +
              '<i\n' +
              "  class=\"bar\" // expected [ 'bar' ] to contain 'foo', 'bar', 'baz'\n" +
              '></i>'
          );
        });

        it('should match partial class attributes', function() {
          this.body.innerHTML = '<i class="foo bar baz"></i>';

          expect(this.body.firstChild, 'to have attributes', {
            class: 'foo bar'
          });
        });

        it('should match partial class attributes in different order', function() {
          this.body.innerHTML = '<i class="foo bar baz"></i>';

          expect(this.body.firstChild, 'to have attributes', {
            class: 'baz foo'
          });
        });

        describe('exact matches', () => {
          it('should match an exact class set', function() {
            this.body.innerHTML = '<i class="foo bar baz"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              class: 'foo bar baz'
            });
          });

          it('should match an exact class set in different order', function() {
            this.body.innerHTML = '<i class="foo bar baz"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              class: 'foo baz bar'
            });
          });

          it('should throw if class set contains more classes than comparator', function() {
            this.body.innerHTML = '<i class="foo bar baz"></i>';
            const el = this.body.firstChild;

            expect(
              () => {
                expect(el, 'to only have attributes', {
                  class: 'foo baz'
                });
              },
              'to throw',
              /to only have attributes \{ class: 'foo baz' \}/
            );
          });

          it('should throw if class set contains less classes than comparator', function() {
            this.body.innerHTML = '<i class="foo baz"></i>';
            const el = this.body.firstChild;

            expect(
              () => {
                expect(el, 'to only have attributes', {
                  class: 'foo bar baz'
                });
              },
              'to throw',
              /to only have attributes \{ class: 'foo bar baz' \}/
            );
          });
        });
      });

      describe('style attribute', () => {
        describe('lax comparison', () => {
          it('should do string comparisons', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'color: red; background: blue'
            });
          });

          it('should do string comparisons in any order', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should do string comparisons on partial values', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'background: blue'
            });
          });

          it('should fail when styles are missing', function() {
            this.body.innerHTML = '<i style="color: red"></i>';
            const node = this.body.firstChild;

            expect(
              () => {
                expect(node, 'to have attributes', {
                  style: 'background: blue'
                });
              },
              'to throw',
              /to have attributes \{ style: 'background: blue' \}/
            );
          });

          it('should do object comparisons', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: {
                color: 'red',
                background: 'blue'
              }
            });
          });

          it('should do partial object comparisons', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: {
                background: 'blue'
              }
            });
          });

          it('should fail on missing partial object comparisons', function() {
            this.body.innerHTML = '<i style="color: red"></i>';
            const node = this.body.firstChild;

            expect(
              () => {
                expect(node, 'to have attributes', {
                  style: {
                    background: 'blue'
                  }
                });
              },
              'to throw',
              /to have attributes \{ style: \{ background: 'blue' \} \}/
            );
          });

          it('should handle trailing semicolon', function() {
            this.body.innerHTML = '<div style="color: red;"></div>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: {
                color: 'red'
              }
            });
          });
        });

        describe('strict comparison', () => {
          it('should do string comparisons', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: 'color: red; background: blue'
            });
          });

          it('should do string comparisons in any order', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should fail when styles are missing', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';
            const node = this.body.firstChild;

            expect(
              () => {
                expect(node, 'to only have attributes', {
                  style: 'background: blue'
                });
              },
              'to throw',
              /to only have attributes \{ style: 'background: blue' \}/
            );
          });

          it('should do object comparisons', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: {
                color: 'red',
                background: 'blue'
              }
            });
          });

          it('should fail on missing partial object comparisons', function() {
            this.body.innerHTML =
              '<i style="color: red; background: blue"></i>';
            const node = this.body.firstChild;

            expect(
              () => {
                expect(node, 'to only have attributes', {
                  style: {
                    background: 'blue'
                  }
                });
              },
              'to throw',
              /to only have attributes \{ style: \{ background: 'blue' \} \}/
            );
          });
        });
      });
    });
  });

  describe('not to have attributes', () => {
    describe('when given one of more strings', () => {
      it('should pass if the given element does not have any the provided attribute names', () => {
        body.innerHTML = '<div style="color: red; background: blue" />';
        const node = body.firstChild;

        expect(node, 'not to have attributes', 'data-test-id', 'class');
      });

      it('should fail if the given element has one of the provided attributes', () => {
        body.innerHTML =
          '<div style="color: red; background: blue" class="my-class"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', 'data-test-id', 'class');
          },
          'to throw',
          'expected <div class="my-class" style="color: red; background: blue"></div>\n' +
            "not to have attributes 'data-test-id', 'class'\n" +
            '\n' +
            '<div\n' +
            '  style="color: red; background: blue"\n' +
            '  class="my-class" // should be removed\n' +
            '></div>'
        );
      });

      it('should fail if the given element has multiple of the provided attributes', () => {
        body.innerHTML =
          '<div data-test-id="my-div" style="color: red; background: blue" class="my-class"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', 'data-test-id', 'class');
          },
          'to throw',
          'expected <div class="my-class" data-test-id="my-div" style="color: red; background: blue"></div>\n' +
            "not to have attributes 'data-test-id', 'class'\n" +
            '\n' +
            '<div\n' +
            '  data-test-id="my-div" // should be removed\n' +
            '  style="color: red; background: blue"\n' +
            '  class="my-class" // should be removed\n' +
            '></div>'
        );
      });
    });

    describe('when given an array', () => {
      it('should pass if the given element does not have any of the provided attribute names', () => {
        body.innerHTML = '<div style="color: red; background: blue" />';
        const node = body.firstChild;

        expect(node, 'not to have attributes', ['data-test-id', 'class']);
      });

      it('should fail if the given element has one of the provided attributes', () => {
        body.innerHTML =
          '<div style="color: red; background: blue" class="my-class"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', ['data-test-id', 'class']);
          },
          'to throw',
          'expected <div class="my-class" style="color: red; background: blue"></div>\n' +
            "not to have attributes [ 'data-test-id', 'class' ]\n" +
            '\n' +
            '<div\n' +
            '  style="color: red; background: blue"\n' +
            '  class="my-class" // should be removed\n' +
            '></div>'
        );
      });

      it('should fail if the given element has multiple of the provided attributes', () => {
        body.innerHTML =
          '<div data-test-id="my-div" style="color: red; background: blue" class="my-class"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', ['data-test-id', 'class']);
          },
          'to throw',
          'expected <div class="my-class" data-test-id="my-div" style="color: red; background: blue"></div>\n' +
            "not to have attributes [ 'data-test-id', 'class' ]\n" +
            '\n' +
            '<div\n' +
            '  data-test-id="my-div" // should be removed\n' +
            '  style="color: red; background: blue"\n' +
            '  class="my-class" // should be removed\n' +
            '></div>'
        );
      });
    });
  });

  describe('to have children', () => {
    describe('with no children flag', () => {
      it('should match element with no children', function() {
        this.body.innerHTML = '<div></div>';
        const el = this.body.firstChild;

        expect(el, 'to have no children');
      });

      it('should fail on element with HTMLElement children', function() {
        this.body.innerHTML = '<div><p></p></div>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have no children');
          },
          'to throw',
          /^expected <div><p><\/p><\/div> to have no children/
        );
      });

      it('should fail on element with HTMLComment children', function() {
        this.body.innerHTML = '<div><!-- Comment --></div>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have no children');
          },
          'to throw',
          /^expected <div><!-- Comment --><\/div> to have no children/
        );
      });

      it('should fail on element with TextNode children', function() {
        this.body.innerHTML = '<div>I am a text</div>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have no children');
          },
          'to throw',
          /^expected <div>I am a text<\/div> to have no children/
        );
      });
    });
  });

  describe('to satisfy', () => {
    it('should fail if an unsupported property is passed in the value', () => {
      body.innerHTML = '<div foo="bar"></div>';
      expect(
        () => {
          expect(body.firstChild, 'to satisfy', { foo: 'bar' });
        },
        'to throw',
        'Unsupported option: foo'
      );
    });

    describe('with boolean attributes', () => {
      describe('draggable', () => {
        it('should allow "true"', () => {
          body.innerHTML = '<div draggable="true"></div>';
          expect(body, 'to satisfy', {
            children: [
              {
                attributes: {
                  draggable: 'true'
                }
              }
            ]
          });
        });

        it('should allow "false"', () => {
          body.innerHTML = '<div draggable="false"></div>';
          expect(body, 'to satisfy', {
            children: [
              {
                attributes: {
                  draggable: 'false'
                }
              }
            ]
          });
        });

        it('should error on mismatch', () => {
          body.innerHTML = '<div draggable="true"></div>';
          expect(
            () => {
              expect(body, 'to satisfy', {
                children: [
                  {
                    attributes: {
                      draggable: false
                    }
                  }
                ]
              });
            },
            'to throw',
            'expected <body><div draggable></div></body> to satisfy { children: [ { attributes: ... } ] }\n' +
              '\n' +
              '<body>\n' +
              '  <div\n' +
              "    draggable=\"true\" // Invalid expected value false. Supported values include: 'true', 'false'\n" +
              '  ></div>\n' +
              '</body>'
          );
        });
      });
    });

    describe('with a textContent property', () => {
      it('should succeed', () => {
        body.innerHTML = '<div foo="bar">foobarquux</div>';
        expect(body, 'to satisfy', { textContent: 'foobarquux' });
      });

      it('should fail', () => {
        body.innerHTML = '<div foo="bar">foobarquux</div>';

        expect(
          () => {
            expect(body, 'to satisfy', { textContent: 'fooquux' });
          },
          'to throw',
          'expected <body><div foo="bar">foobarquux</div></body> to satisfy { textContent: \'fooquux\' }\n' +
            '\n' +
            '<body>\n' +
            "  <div foo=\"bar\">foobarquux</div> // expected 'foobarquux' to equal 'fooquux'\n" +
            '                                  //\n' +
            '                                  // -foobarquux\n' +
            '                                  // +fooquux\n' +
            '</body>'
        );
      });
    });

    describe('with an HTML fragment string passed as the children attribute', () => {
      it('should succeed', () => {
        expect(
          '<div foo="bar">foo<span>bar</span></div>',
          'when parsed as HTML fragment to satisfy',
          [
            {
              name: 'div',
              children: 'foo<span>bar</span>'
            }
          ]
        );
      });

      it('should fail with a diff', () => {
        expect(
          () => {
            expect(
              '<div foo="bar">foo<span>bar</span></div>',
              'when parsed as HTML fragment to satisfy',
              [
                {
                  name: 'div',
                  children: '<span>bar</span>foo'
                }
              ]
            );
          },
          'to throw',
          'expected \'<div foo="bar">foo<span>bar</span></div>\'\n' +
            "when parsed as HTML fragment to satisfy [ { name: 'div', children: '<span>bar</span>foo' } ]\n" +
            '  expected DocumentFragment[NodeList[ <div foo="bar">foo<span>...</span></div> ]]\n' +
            "  to satisfy [ { name: 'div', children: '<span>bar</span>foo' } ]\n" +
            '\n' +
            '  NodeList[\n' +
            '    <div foo="bar">\n' +
            '      ┌─▷\n' +
            '      │   foo\n' +
            '      └── <span>bar</span> // should be moved\n' +
            '    </div>\n' +
            '  ]'
        );
      });
    });

    describe('when comparing class atttributes', () => {
      it('should succeed when both are present but empty', () => {
        expect(
          '<div class="Component"><span class="foobar"></span><label><span class="">Some test stuff</span></label></div>',
          'when parsed as HTML to satisfy',
          '<div class="Component"><span class="foobar"></span><label><span class="">Some test stuff</span></label></div>'
        );
      });

      it('should succeed when the RHS is absent and LHS has a value', () => {
        expect(
          '<div class="Component"><span></span><label><span class="foobar">Some test stuff</span></label></div>',
          'when parsed as HTML to satisfy',
          '<div class="Component"><span></span><label><span>Some test stuff</span></label></div>'
        );
      });

      it('should succeed when the RHS is absent and LHS is empty', () => {
        expect(
          '<div class="Component"><span></span><label><span class="">Some test stuff</span></label></div>',
          'when parsed as HTML to satisfy',
          '<div class="Component"><span></span><label><span>Some test stuff</span></label></div>'
        );
      });
    });

    describe('HTMLFragment', () => {
      describe('with a string as the value', () => {
        it('should succeed', () => {
          expect(
            '<div foo="bar">foo</div><div>bar</div>',
            'when parsed as HTML fragment to satisfy',
            '<div foo="bar">foo</div><div>bar</div>'
          );
        });

        it('should fail with an error', () => {
          expect(
            () => {
              expect(
                '<div>foo</div><div>bar</div>',
                'when parsed as HTML fragment to satisfy',
                '<div>quux</div><div baz="quux">bar</div>'
              );
            },
            'to throw',
            "expected '<div>foo</div><div>bar</div>'\n" +
              'when parsed as HTML fragment to satisfy \'<div>quux</div><div baz="quux">bar</div>\'\n' +
              '  expected DocumentFragment[NodeList[ <div>foo</div>, <div>bar</div> ]]\n' +
              '  to satisfy <div>quux</div><div baz="quux">bar</div>\n' +
              '\n' +
              '  NodeList[\n' +
              '    <div>\n' +
              "      foo // should equal 'quux'\n" +
              '          //\n' +
              '          // -foo\n' +
              '          // +quux\n' +
              '    </div>,\n' +
              '    <div\n' +
              "      // missing baz should equal 'quux'\n" +
              '    >bar</div>\n' +
              '  ]'
          );
        });
      });

      describe('with the exhaustively flag', () => {
        it('should fail with a diff', () => {
          expect(
            () => {
              expect(
                '<div foo="bar" baz="quux">foo</div><div>bar</div>',
                'when parsed as HTML fragment to exhaustively satisfy',
                '<div foo="bar">foo</div><div>bar</div>'
              );
            },
            'to throw',
            'expected \'<div foo="bar" baz="quux">foo</div><div>bar</div>\'\n' +
              'when parsed as HTML fragment to exhaustively satisfy \'<div foo="bar">foo</div><div>bar</div>\'\n' +
              '  expected DocumentFragment[NodeList[ <div baz="quux" foo="bar">foo</div>, <div>bar</div> ]]\n' +
              '  to exhaustively satisfy <div foo="bar">foo</div><div>bar</div>\n' +
              '\n' +
              '  NodeList[\n' +
              '    <div\n' +
              '      foo="bar"\n' +
              '      baz="quux" // should be removed\n' +
              '    >foo</div>,\n' +
              '    <div>bar</div>\n' +
              '  ]'
          );
        });
      });

      describe('with an HTMLFragment as the value', () => {
        it('should succeed', () => {
          expect(
            '<div foo="bar">foo</div><div>bar</div>',
            'when parsed as HTML fragment to satisfy',
            parseHtmlFragment('<div foo="bar">foo</div><div>bar</div>')
          );
        });

        it('should fail with an error', () => {
          expect(
            () => {
              expect(
                '<div>foo</div><div>bar</div>',
                'when parsed as HTML fragment to satisfy',
                parseHtmlFragment('<div>quux</div><div baz="quux">bar</div>')
              );
            },
            'to throw',
            "expected '<div>foo</div><div>bar</div>'\n" +
              'when parsed as HTML fragment to satisfy DocumentFragment[NodeList[ <div>quux</div>, <div baz="quux">bar</div> ]]\n' +
              '  expected DocumentFragment[NodeList[ <div>foo</div>, <div>bar</div> ]]\n' +
              '  to satisfy DocumentFragment[NodeList[ <div>quux</div>, <div baz="quux">bar</div> ]]\n' +
              '\n' +
              '  NodeList[\n' +
              '    <div>\n' +
              "      foo // should equal 'quux'\n" +
              '          //\n' +
              '          // -foo\n' +
              '          // +quux\n' +
              '    </div>,\n' +
              '    <div\n' +
              "      // missing baz should equal 'quux'\n" +
              '    >bar</div>\n' +
              '  ]'
          );
        });

        describe('and it contains an ignore comment', () => {
          it('ignores the corresponding subtree', () => {
            expect(
              [
                '<div foo="bar">foo</div>',
                '<div><div>bar</div></div>',
                '<div>baz</div>'
              ].join('\n'),
              'when parsed as HTML fragment to satisfy',
              parseHtmlFragment(
                ['<div>foo</div>', '<!--ignore-->', '<div>baz</div>'].join('\n')
              )
            );
          });

          it('ignores the corresponding text node', () => {
            expect(
              [
                '<div foo="bar">foo</div>',
                '<div>bar</div>',
                '<div>baz</div>'
              ].join('\n'),
              'when parsed as HTML fragment to satisfy',
              parseHtmlFragment(
                [
                  '<div>foo</div>',
                  '<div><!--ignore--></div>',
                  '<div>baz</div>'
                ].join('\n')
              )
            );
          });

          it('inspects correctly when another subtree', () => {
            expect(
              () => {
                expect(
                  '<div foo="bar">foo</div><div><div>bar</div></div><div>baz</div>',
                  'when parsed as HTML fragment to satisfy',
                  parseHtmlFragment(
                    '<div foo="bar">foo!</div><!--ignore--><div>baz</div>'
                  )
                );
              },
              'to throw',
              [
                'expected \'<div foo="bar">foo</div><div><div>bar</div></div><div>baz</div>\'',
                'when parsed as HTML fragment to satisfy DocumentFragment[NodeList[ <div foo="bar">foo!</div>, <!--ignore-->, <div>baz</div> ]]',
                '  expected DocumentFragment[NodeList[ <div foo="bar">foo</div>, <div><div>...</div></div>, <div>baz</div> ]]',
                '  to satisfy DocumentFragment[NodeList[ <div foo="bar">foo!</div>, <!--ignore-->, <div>baz</div> ]]',
                '',
                '  NodeList[',
                '    <div foo="bar">',
                "      foo // should equal 'foo!'",
                '          //',
                '          // -foo',
                '          // +foo!',
                '    </div>,',
                '    <div><div>...</div></div>,',
                '    <div>baz</div>',
                '  ]'
              ].join('\n')
            );
          });
        });
      });

      describe('with an array as the value', () => {
        it('should succeed', () => {
          expect(
            '<div foo="bar">foo</div><div>bar</div>',
            'when parsed as HTML fragment to satisfy',
            [
              { attributes: { foo: 'bar' }, children: ['foo'] },
              { name: 'div', children: ['bar'] }
            ]
          );
        });

        it('should fail with an error', () => {
          expect(
            () => {
              expect(
                '<div foo="baz">foo</div><div>foobar</div>',
                'when parsed as HTML fragment to satisfy',
                [
                  { attributes: { foo: 'bar' }, children: ['foo'] },
                  { name: 'div', children: ['bar'] }
                ]
              );
            },
            'to throw',
            'expected \'<div foo="baz">foo</div><div>foobar</div>\' when parsed as HTML fragment\n' +
              'to satisfy [\n' +
              "  { attributes: { foo: 'bar' }, children: [ 'foo' ] },\n" +
              "  { name: 'div', children: [ 'bar' ] }\n" +
              ']\n' +
              '  expected DocumentFragment[NodeList[ <div foo="baz">foo</div>, <div>foobar</div> ]] to satisfy\n' +
              '  [\n' +
              "    { attributes: { foo: 'bar' }, children: [ 'foo' ] },\n" +
              "    { name: 'div', children: [ 'bar' ] }\n" +
              '  ]\n' +
              '\n' +
              '  NodeList[\n' +
              '    <div\n' +
              "      foo=\"baz\" // expected 'baz' to equal 'bar'\n" +
              '                //\n' +
              '                // -baz\n' +
              '                // +bar\n' +
              '    >foo</div>,\n' +
              '    <div>\n' +
              "      foobar // should equal 'bar'\n" +
              '             //\n' +
              '             // -foobar\n' +
              '             // +bar\n' +
              '    </div>\n' +
              '  ]'
          );
        });
      });

      describe('with an object as the value', () => {
        it('should succeed', () => {
          expect(
            '<div foo="bar">foo</div><div>bar</div>',
            'when parsed as HTML fragment to satisfy',
            {
              1: { name: 'div', children: ['bar'] }
            }
          );
        });

        it('should fail with an error', () => {
          expect(
            () => {
              expect(
                '<div foo="baz">foo</div><div>foobar</div>',
                'when parsed as HTML fragment to satisfy',
                {
                  1: { name: 'div', children: ['bar'] }
                }
              );
            },
            'to throw',
            'expected \'<div foo="baz">foo</div><div>foobar</div>\'\n' +
              "when parsed as HTML fragment to satisfy { 1: { name: 'div', children: [ 'bar' ] } }\n" +
              '  expected DocumentFragment[NodeList[ <div foo="baz">foo</div>, <div>foobar</div> ]]\n' +
              "  to satisfy { 1: { name: 'div', children: [ 'bar' ] } }\n" +
              '\n' +
              '  NodeList[\n' +
              '    <div foo="baz">foo</div>,\n' +
              '    <div>\n' +
              "      foobar // should equal 'bar'\n" +
              '             //\n' +
              '             // -foobar\n' +
              '             // +bar\n' +
              '    </div>\n' +
              '  ]'
          );
        });
      });

      describe('with a regexp as the value', () => {
        it('should fail', () => {
          expect(
            () => {
              expect(
                '<div foo="bar">foo</div><div>bar</div>',
                'when parsed as HTML fragment to satisfy',
                /foo/
              );
            },
            'to throw',
            'expected \'<div foo="bar">foo</div><div>bar</div>\' when parsed as HTML fragment to satisfy /foo/\n' +
              '  expected DocumentFragment[NodeList[ <div foo="bar">foo</div>, <div>bar</div> ]] to satisfy /foo/'
          );
        });
      });
    });

    describe('HTMLElement with a string as the value', () => {
      it('should succeed when the subject equals the value parsed as HTML', () =>
        expect(
          parseHtml('<div foo="bar" baz="quux">hey</div>'),
          'to satisfy',
          '<div foo="bar" baz="quux">hey</div>'
        ));

      it('should fail when the subject has the wrong text content', () =>
        expect(
          parseHtml('<div foo="bar" baz="quux">hey</div>'),
          'to satisfy',
          '<div foo="bar" baz="quux">hey</div>'
        ));

      it('should succeed when the subject equals the value parsed as HTML', () =>
        expect(
          parseHtml('<div foo="bar" baz="quux">hey</div>'),
          'to satisfy',
          '<div foo="bar">hey</div>'
        ));

      it('should fail when the subject is missing an attribute', () =>
        expect(
          () =>
            expect(
              parseHtml('<div foo="bar">hey</div>'),
              'to satisfy',
              '<div bar="quux">hey</div>'
            ),
          'to error',
          'expected <div foo="bar">hey</div> to satisfy <div bar="quux">hey</div>\n' +
            '\n' +
            '<div\n' +
            '  foo="bar"\n' +
            "  // missing bar should equal 'quux'\n" +
            '>hey</div>'
        ));

      it('should succeed when the subject has an extra class', () =>
        expect(
          parseHtml('<div class="foo bar">hey</div>'),
          'to satisfy',
          '<div class="bar">hey</div>'
        ));

      it('should fail when the subject is missing a class', () =>
        expect(
          () =>
            expect(
              parseHtml('<div class="foo">hey</div>'),
              'to satisfy',
              '<div class="bar">hey</div>'
            ),
          'to error',
          'expected <div class="foo">hey</div> to satisfy <div class="bar">hey</div>\n' +
            '\n' +
            '<div\n' +
            "  class=\"foo\" // expected [ 'foo' ] to contain 'bar'\n" +
            '>hey</div>'
        ));

      it('should succeed when the subject has an extra inline style', () =>
        expect(
          parseHtml('<div style="color: tan; width: 120px;">hey</div>'),
          'to satisfy',
          '<div style="color: tan;">hey</div>'
        ));

      it('should fail when the subject is missing an inline style', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="width: 120px;">hey</div>'),
              'to satisfy',
              '<div style="color: tan;">hey</div>'
            ),
          'to error',
          'expected <div style="width: 120px">hey</div> to satisfy <div style="color: tan;">hey</div>\n' +
            '\n' +
            '<div\n' +
            "  style=\"width: 120px\" // expected { width: '120px' } to satisfy { color: 'tan' }\n" +
            '                       //\n' +
            '                       // {\n' +
            "                       //   width: '120px'\n" +
            "                       //   // missing color: 'tan'\n" +
            '                       // }\n' +
            '>hey</div>'
        ));
    });

    describe('HTMLElement with a DOM element as the value', () => {
      it('should succeed when the subject equals the value parsed as HTML', () =>
        expect(
          parseHtml('<div foo="bar" baz="quux">hey</div>'),
          'to satisfy',
          parseHtml('<div foo="bar" baz="quux">hey</div>')
        ));

      it('should fail when the subject has the wrong text content', () =>
        expect(
          () =>
            expect(
              parseHtml('<div foo="bar" baz="quux">foobar</div>'),
              'to satisfy',
              parseHtml('<div foo="bar" baz="quux">hey</div>')
            ),
          'to error',
          'expected <div baz="quux" foo="bar">foobar</div> to satisfy <div baz="quux" foo="bar">hey</div>\n' +
            '\n' +
            '<div foo="bar" baz="quux">\n' +
            "  foobar // should equal 'hey'\n" +
            '         //\n' +
            '         // -foobar\n' +
            '         // +hey\n' +
            '</div>'
        ));

      it('should succeed when the subject equals the value parsed as HTML', () =>
        expect(
          parseHtml('<div foo="bar" baz="quux">hey</div>'),
          'to satisfy',
          parseHtml('<div foo="bar">hey</div>')
        ));

      it('should fail when the subject is missing an attribute', () =>
        expect(
          () =>
            expect(
              parseHtml('<div foo="bar">hey</div>'),
              'to satisfy',
              parseHtml('<div bar="quux">hey</div>')
            ),
          'to error',
          'expected <div foo="bar">hey</div> to satisfy <div bar="quux">hey</div>\n' +
            '\n' +
            '<div\n' +
            '  foo="bar"\n' +
            "  // missing bar should equal 'quux'\n" +
            '>hey</div>'
        ));

      it('should succeed when the subject has an extra class', () =>
        expect(
          parseHtml('<div class="foo bar">hey</div>'),
          'to satisfy',
          parseHtml('<div class="bar">hey</div>')
        ));

      it('should fail when the subject is missing a class', () =>
        expect(
          () =>
            expect(
              parseHtml('<div class="foo">hey</div>'),
              'to satisfy',
              parseHtml('<div class="bar">hey</div>')
            ),
          'to error',
          'expected <div class="foo">hey</div> to satisfy <div class="bar">hey</div>\n' +
            '\n' +
            '<div\n' +
            "  class=\"foo\" // expected [ 'foo' ] to contain 'bar'\n" +
            '>hey</div>'
        ));

      it('should succeed when the subject has an extra inline style', () =>
        expect(
          parseHtml(
            '<div style="color: tan; width: 120px; z-index: 700; background-repeat: no-repeat">hey</div>'
          ),
          'to satisfy',
          parseHtml(
            '<div style="color: tan; z-index: 700;background-repeat: no-repeat">hey</div>'
          )
        ));

      it('should not fail for invalid style attributes on the LHS', () =>
        expect(
          parseHtml('<div style="color; width: 120px; z-index: 700">hey</div>'),
          'to satisfy',
          parseHtml('<div style="width: 120px;">hey</div>')
        ));

      it('should treat an empty style string no requirements on the style attribute', () =>
        expect(
          parseHtml('<div style="color; width: 120px;">hey</div>'),
          'to satisfy',
          parseHtml('<div style="">hey</div>')
        ));

      it('should not fail for a style attribute with hex value (short) on the RHS', () => {
        expect(
          parseHtml('<div style="border-left-color: #000">hey</div>'),
          'to satisfy',
          parseHtml('<div style="border-left-color: #000;">hey</div>')
        );
      });

      it('should not fail for a style attribute with hex value (long) on the RHS', () => {
        expect(
          parseHtml('<div style="border-left-color: #1BcD3F">hey</div>'),
          'to satisfy',
          parseHtml('<div style="border-left-color: #1BcD3F;">hey</div>')
        );
      });

      it('should fail when the RHS has invalid styles', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="border-left-color: #FFF">hey</div>'),
              'to satisfy',
              parseHtml('<div style="border-left-color: #FFFF;">hey</div>')
            ),
          'to error',
          'expected <div style="border-left-color: #FFF">hey</div>\n' +
            'to satisfy <div style="border-left-color: #FFFF">hey</div>\n' +
            '\n' +
            '<div\n' +
            '  style="border-left-color: #FFF" // expected <div style="border-left-color: #FFF">hey</div>\n' +
            "                                  // to satisfy { name: 'div', attributes: { style: 'border-left-color: #FFFF;' }, children: [ 'hey' ] }\n" +
            "                                  //   Expectation contains invalid styles: 'border-left-color: #FFFF'\n" +
            '>hey</div>'
        ));

      it('should fail when the RHS has invalid styles', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="width: 120px;">hey</div>'),
              'to satisfy',
              parseHtml('<div style="color;background;width: 120px">hey</div>')
            ),
          'to error',
          'expected <div style="width: 120px">hey</div> to satisfy <div style="width: 120px">hey</div>\n' +
            '\n' +
            '<div\n' +
            '  style="width: 120px" // expected <div style="width: 120px">hey</div>\n' +
            "                       // to satisfy { name: 'div', attributes: { style: 'color;background;width: 120px' }, children: [ 'hey' ] }\n" +
            "                       //   Expectation contains invalid styles: 'color;background'\n" +
            '>hey</div>'
        ));

      it('should fail when the subject is missing an inline style', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="width: 120px;">hey</div>'),
              'to satisfy',
              parseHtml('<div style="color: tan;">hey</div>')
            ),
          'to error',
          'expected <div style="width: 120px">hey</div> to satisfy <div style="color: tan">hey</div>\n' +
            '\n' +
            '<div\n' +
            "  style=\"width: 120px\" // expected { width: '120px' } to satisfy { color: 'tan' }\n" +
            '                       //\n' +
            '                       // {\n' +
            "                       //   width: '120px'\n" +
            "                       //   // missing color: 'tan'\n" +
            '                       // }\n' +
            '>hey</div>'
        ));
    });

    describe('text node with a text node as the value', () => {
      it('should succeed', () => {
        expect(parseHtml('foobar'), 'to satisfy', parseHtml('foobar'));
      });

      // Doesn't alter the semantics, but needs to be supported:
      it('should succeed when the exhaustively flag is set', () => {
        expect(
          parseHtml('foobar'),
          'to exhaustively satisfy',
          parseHtml('foobar')
        );
      });

      it('should fail with a diff', () => {
        expect(
          () => {
            expect(parseHtml('foobar'), 'to satisfy', parseHtml('bar'));
          },
          'to error',
          'expected foobar to satisfy bar\n' + '\n' + '-foobar\n' + '+bar'
        );
      });
    });

    describe('text node with a regexp as the value', () => {
      it('should succeed', () => {
        expect(parseHtml('foobar'), 'to satisfy', /^foo/);
      });

      // Doesn't alter the semantics, but needs to be supported:
      it('should succeed when the exhaustively flag is set', () => {
        expect(parseHtml('foobar'), 'to exhaustively satisfy', /^foo/);
      });

      it('should fail with a diff', () => {
        expect(
          () => {
            expect(parseHtml('foobar'), 'to satisfy', /^f00/);
          },
          'to error',
          'expected foobar to satisfy /^f00/'
        );
      });
    });

    describe('with a name assertion', () => {
      it('should succeed', () => {
        body.innerHTML = '<div foo="bar"></div>';
        expect(body.firstChild, 'to satisfy', { name: /^d/ });
      });

      it('should fail with a diff', () => {
        body.innerHTML = '<div foo="bar"></div>';
        expect(
          () => {
            expect(body.firstChild, 'to satisfy', { name: /^sp/ });
          },
          'to throw',
          'expected <div foo="bar"></div> to satisfy { name: /^sp/ }\n' +
            '\n' +
            '<div // should match /^sp/\n' +
            '  foo="bar"\n' +
            '></div>'
        );
      });

      describe('in an XML document with a mixed case node name', () => {
        const xmlDoc = parseXml(
          '<?xml version="1.0"?><fooBar hey="there"></fooBar>'
        );

        it('should succeed', () => {
          expect(xmlDoc.firstChild, 'to satisfy', { name: 'fooBar' });
        });

        it('should fail with a diff', () => {
          expect(
            () => {
              expect(xmlDoc.firstChild, 'to satisfy', { name: 'fooBarQuux' });
            },
            'to throw',
            'expected <fooBar hey="there"></fooBar> to satisfy { name: \'fooBarQuux\' }\n' +
              '\n' +
              "<fooBar // should equal 'fooBarQuux'\n" +
              '  hey="there"\n' +
              '></fooBar>'
          );
        });
      });
    });

    describe('with a children assertion', () => {
      it('should succeed', () => {
        body.innerHTML = '<div foo="bar">hey</div>';
        expect(body.firstChild, 'to satisfy', { children: ['hey'] });
      });

      it('should succeed with a node child', () => {
        const node = theDocument.createElement('div');
        node.innerHTML = '<div foo="bar">hey</div>';
        body.innerHTML = '<div><div foo="bar">hey</div></div>';
        expect(body.firstChild, 'to satisfy', {
          children: [node.firstChild]
        });
      });

      it('should fail with a diff', () => {
        body.innerHTML = '<div foo="bar">hey</div>';
        expect(
          () => {
            expect(body.firstChild, 'to satisfy', { children: ['there'] });
          },
          'to throw',
          'expected <div foo="bar">hey</div> to satisfy { children: [ \'there\' ] }\n' +
            '\n' +
            '<div foo="bar">\n' +
            "  hey // should equal 'there'\n" +
            '      //\n' +
            '      // -hey\n' +
            '      // +there\n' +
            '</div>'
        );
      });

      describe('when using ignore', () => {
        it('should succeed', () => {
          const node = theDocument.createElement('div');
          node.innerHTML = '<!-- ignore -->';
          const commentNode = node.firstChild;
          body.innerHTML =
            '<div><span>ignore</span><span>important</span></div>';
          expect(body.firstChild, 'to satisfy', {
            children: [
              commentNode,
              {
                children: 'important'
              }
            ]
          });
        });
      });
    });

    describe('when matching against <!-- ignore -->', () => {
      const ignoreComment = parseHtmlNode('<!--ignore-->');

      it('should match a text node', () => {
        expect(parseHtmlNode('foo'), 'to satisfy', ignoreComment);
      });

      it('should match an element', () => {
        expect(parseHtmlNode('<div>foo</div>'), 'to satisfy', ignoreComment);
      });

      it('should match a comment', () => {
        expect(parseHtmlNode('<!-- foo -->'), 'to satisfy', ignoreComment);
      });

      it('should match a doctype', () => {
        expect(
          parseHtmlDocument('<!DOCTYPE html>').firstChild,
          'to satisfy',
          ignoreComment
        );
      });

      it('should match a document', () => {
        expect(
          '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>',
          'when parsed as xml to satisfy',
          ignoreComment
        );
      });
    });

    it('should fail with a diff', () => {
      body.innerHTML =
        '<div foo="bar" id="quux">foobar</div><div foo="quux">hey</div>';
      expect(
        () => {
          expect(body, 'queried for', 'div', 'to satisfy', {
            1: { attributes: { foo: 'bar' } }
          });
        },
        'to throw',
        'expected\n' +
          '<body>\n' +
          '  <div foo="bar" id="quux">foobar</div>\n' +
          '  <div foo="quux">hey</div>\n' +
          '</body>\n' +
          "queried for div to satisfy { 1: { attributes: { foo: 'bar' } } }\n" +
          '  expected NodeList[ <div foo="bar" id="quux">foobar</div>, <div foo="quux">hey</div> ]\n' +
          "  to satisfy { 1: { attributes: { foo: 'bar' } } }\n" +
          '\n' +
          '  NodeList[\n' +
          '    <div foo="bar" id="quux">foobar</div>,\n' +
          '    <div\n' +
          "      foo=\"quux\" // expected 'quux' to equal 'bar'\n" +
          '                 //\n' +
          '                 // -quux\n' +
          '                 // +bar\n' +
          '    >hey</div>\n' +
          '  ]'
      );
    });
  });

  describe('queried for', () => {
    it('should work with HTMLDocument', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div id="foo"></div></body></html>'
      );
      expect(document, 'queried for first', 'div', 'to have attributes', {
        id: 'foo'
      });
    });

    it('should provide the results as the fulfillment value when no assertion is provided', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div id="foo"></div></body></html>'
      );
      return expect(document, 'queried for first', 'div').then(div => {
        expect(div, 'to have attributes', { id: 'foo' });
      });
    });

    it('should error out if the selector matches no elements, first flag set', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div id="foo"></div></body></html>'
      );
      expect(
        () => {
          expect(
            document.body,
            'queried for first',
            '.blabla',
            'to have attributes',
            { id: 'foo' }
          );
        },
        'to throw',
        'expected <body><div id="foo"></div></body> queried for first .blabla to have attributes { id: \'foo\' }\n' +
          '  The selector .blabla yielded no results'
      );
    });

    it('should error out if the selector matches no elements, first flag not set', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div id="foo"></div></body></html>'
      );
      expect(
        () => {
          expect(
            document.body,
            'queried for',
            '.blabla',
            'to have attributes',
            { id: 'foo' }
          );
        },
        'to throw',
        'expected <body><div id="foo"></div></body> queried for .blabla to have attributes { id: \'foo\' }\n' +
          '  The selector .blabla yielded no results'
      );
    });

    it('should return an array-like NodeList', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div></div><div></div><div></div></body></html>'
      );

      expect(document, 'queried for', 'div', 'to be a', 'DOMNodeList');
    });

    it('should be able to use array semantics', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div></div><div></div><div></div></body></html>'
      );

      expect(document, 'queried for', 'div', 'to have length', 3);
    });

    it('should fail array checks with useful nested error message', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><head></head><body><div></div><div></div><div></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'queried for', 'div', 'to have length', 1);
        },
        'to throw',
        'expected <!DOCTYPE html><html><head></head><body>...</body></html> queried for div to have length 1\n' +
          '  expected NodeList[ <div></div>, <div></div>, <div></div> ] to have length 1\n' +
          '    expected 3 to be 1'
      );
    });
  });

  describe('to contain no elements matching', () => {
    it('should pass when not matching anything', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body></body></html>'
      );

      expect(document, 'to contain no elements matching', '.foo');
    });

    it('should fail when matching a single node', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'to contain no elements matching', '.foo');
        },
        'to throw',
        'expected <!DOCTYPE html><html><head></head><body>...</body></html>\n' +
          "to contain no elements matching '.foo'\n" +
          '\n' +
          'NodeList[\n' +
          '  <div class="foo"></div> // should be removed\n' +
          ']'
      );
    });

    it('should fail when matching a NodeList', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'to contain no elements matching', '.foo');
        },
        'to throw',
        'expected <!DOCTYPE html><html><head></head><body>...</body></html>\n' +
          "to contain no elements matching '.foo'\n" +
          '\n' +
          'NodeList[\n' +
          '  <div class="foo"></div>, // should be removed\n' +
          '  <div class="foo"></div> // should be removed\n' +
          ']'
      );
    });
  });

  describe('to contain elements matching', () => {
    it('should pass when matching an element', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(document, 'to contain elements matching', '.foo');
    });

    it('should fail when no elements match', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'to contain elements matching', '.bar');
        },
        'to throw',
        [
          'expected',
          '<!DOCTYPE html><html>',
          '  <head></head>',
          '  <body><div class="foo"></div><div class="foo"></div></body>',
          '</html>',
          "to contain elements matching '.bar'"
        ].join('\n')
      );
    });
  });

  describe('to match', () => {
    it('should match an element correctly', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(document.body.firstChild, 'to match', '.foo');
    });

    it('should fail on matching element with a non-matching selector', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document.body.firstChild, 'to match', '.bar');
        },
        'to throw',
        'expected <div class="foo"></div> to match \'.bar\''
      );
    });

    it("should not match an element that doesn't match the selector", () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(document.body.firstChild, 'not to match', '.bar');
    });

    it('should fail when matching with a selector that was not expected to match', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document.body.firstChild, 'not to match', '.foo');
        },
        'to throw',
        'expected <div class="foo"></div> not to match \'.foo\''
      );
    });
  });

  describe('diffing', () => {
    expect.addAssertion(
      '<string|DOMNode|DOMDocument> diffed with <string|DOMNode|DOMDocument> <assertion>',
      (expect, subject, value) => {
        if (typeof subject === 'string') {
          subject = parseHtml(subject);
        }
        if (typeof value === 'string') {
          value = parseHtml(value);
        }
        return expect.shift(expect.diff(subject, value).toString());
      }
    );

    it('should work with HTMLElement', () => {
      expect(
        '<div><div id="foo"></div><div id="bar"></div></div>',
        'diffed with',
        '<div><div id="foo"></div><div id="quux"></div></div>',
        'to equal',
        '<div>\n' +
          '  <div id="foo"></div>\n' +
          '  <div id="bar" // should equal \'quux\'\n' +
          '  ></div>\n' +
          '</div>'
      );
    });

    it('should work with HTMLElement with text nodes and comments inside', () => {
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
          '</div>'
      );
    });

    it('should report a missing child correctly', () => {
      expect(
        '<div>foo<!--bar--></div>',
        'diffed with',
        '<div>foo<span></span><!--bar--></div>',
        'to equal',
        '<div>\n' +
          '  foo\n' +
          '  // missing <span></span>\n' +
          '  <!--bar-->\n' +
          '</div>'
      );
    });

    it('should report an extraneous child correctly', () => {
      expect(
        '<div>foo<span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<!--bar--></div>',
        'to equal',
        '<div>\n' +
          '  foo\n' +
          '  <span></span> // should be removed\n' +
          '  <!--bar-->\n' +
          '</div>'
      );
    });

    it('should produce a nested diff when the outer elements are identical', () => {
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
          '</div>'
      );
    });

    it('should produce a nested diff when when the outer element has a different set of attributes', () => {
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
          '</div>'
      );
    });

    it('should diff documents with stuff around the documentElement', () => {
      expect(
        parseHtmlDocument(
          '<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->'
        ),
        'diffed with',
        parseHtmlDocument(
          '<!DOCTYPE html><html><head></head><body></body></html>'
        ),
        'to equal',
        '<!DOCTYPE html>\n' +
          '<!--foo--> // should be removed\n' +
          '<html><head></head><body></body></html>\n' +
          '<!--bar--> // should be removed'
      );
    });
  });

  describe('when parsed as HTML', () => {
    const htmlSrc = '<!DOCTYPE html><html><body class="bar">foo</body></html>';
    it('should parse a string as a complete HTML document', () => {
      expect(
        htmlSrc,
        'when parsed as HTML',
        expect
          .it('to be an', 'HTMLDocument')
          .and('to equal', parseHtmlDocument(htmlSrc))
          .and('queried for first', 'body', 'to have attributes', {
            class: 'bar'
          })
      );
    });

    it('should provide the parsed document as the fulfillment value when no assertion is provided', () =>
      expect(htmlSrc, 'parsed as HTML').then(document => {
        expect(document, 'to equal', parseHtmlDocument(htmlSrc));
      }));

    describe('with the "fragment" flag', () => {
      it('should return a DocumentFragment instance', () => {
        expect(
          '<div>foo</div><div>bar</div>',
          'when parsed as HTML fragment',
          expect
            .it('to be a', 'DOMDocumentFragment')
            .and('to satisfy', [
              { name: 'div', children: ['foo'] },
              { name: 'div', children: ['bar'] }
            ])
        );
      });

      it('should provide the parsed fragment as the fulfillment value when no assertion is provided', () =>
        expect('<div>foo</div><div>bar</div>', 'parsed as HTML fragment').then(
          fragment => {
            expect(fragment, 'to satisfy', [
              { children: 'foo' },
              { children: 'bar' }
            ]);
          }
        ));
    });

    it('should fail when the next assertion fails', () => {
      expect(
        () => {
          expect(
            htmlSrc,
            'when parsed as HTML',
            'queried for first',
            'body',
            'to have attributes',
            { class: 'quux' }
          );
        },
        'to throw',
        'expected \'<!DOCTYPE html><html><body class="bar">foo</body></html>\'\n' +
          "when parsed as HTML queried for first 'body' to have attributes { class: 'quux' }\n" +
          '  expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>\n' +
          "  queried for first body to have attributes { class: 'quux' }\n" +
          '    expected <body class="bar">foo</body> to have attributes { class: \'quux\' }\n' +
          '\n' +
          '    <body\n' +
          "      class=\"bar\" // expected [ 'bar' ] to contain 'quux'\n" +
          '    >foo</body>'
      );
    });

    describe('when the DOMParser global is available', () => {
      const OriginalDOMParser = root.DOMParser;
      const safeParseHtmlDocument =
        typeof jsdom !== 'undefined'
          ? str => new jsdom.JSDOM(str).window.document
          : str => new OriginalDOMParser().parseFromString(str, 'text/html');

      let DOMParserSpy;
      let parseFromStringSpy;
      beforeEach(() => {
        DOMParser = DOMParserSpy = sinon
          .spy(() => ({
            parseFromString: (parseFromStringSpy = sinon
              .spy(htmlString => safeParseHtmlDocument(htmlString))
              .named('parseFromString'))
          }))
          .named('DOMParser');
      });
      afterEach(() => {
        DOMParser = OriginalDOMParser;
      });

      it('should use DOMParser to parse the document', () => {
        expect(
          htmlSrc,
          'when parsed as HTML',
          'queried for first',
          'body',
          'to have text',
          'foo'
        );
        expect(
          [DOMParserSpy, parseFromStringSpy],
          'to have calls satisfying',
          () => {
            // eslint-disable-next-line no-new
            new DOMParserSpy();
            parseFromStringSpy(htmlSrc, 'text/html');
          }
        );
      });
    });

    if (typeof jsdom !== 'undefined') {
      describe('when the document global is available', () => {
        const OriginalDOMParser = root.DOMParser;
        let originalDocument, createHTMLDocumentSpy, mockDocument;

        beforeEach(() => {
          mockDocument = parseHtmlDocument(htmlSrc);
          mockDocument.open = sinon.spy().named('document.open');
          mockDocument.write = sinon.spy().named('document.write');
          mockDocument.close = sinon.spy().named('document.close');

          DOMParser = undefined; // force the "implementation" path
          originalDocument = root.document;

          // eslint-disable-next-line no-global-assign
          document = {
            implementation: {
              createHTMLDocument: (createHTMLDocumentSpy = sinon
                .spy(() => {
                  return mockDocument;
                })
                .named('createHTMLDocument'))
            }
          };
        });

        afterEach(() => {
          DOMParser = OriginalDOMParser;
          // eslint-disable-next-line no-global-assign
          document = originalDocument;
        });

        it('should use document.implementation.createHTMLDocument to parse the document', () => {
          expect(
            htmlSrc,
            'when parsed as HTML',
            'queried for first',
            'body',
            'to have text',
            'foo'
          );
          expect(
            [
              createHTMLDocumentSpy,
              mockDocument.open,
              mockDocument.write,
              mockDocument.close
            ],
            'to have calls satisfying',
            () => {
              createHTMLDocumentSpy('');
              mockDocument.open();
              mockDocument.write(htmlSrc);
              mockDocument.close();
            }
          );
        });
      });
    }
  });

  describe('when parsed as XML', () => {
    const xmlSrc = '<?xml version="1.0"?><fooBar yes="sir">foo</fooBar>';
    it('should parse a string as a complete XML document', () => {
      expect(
        xmlSrc,
        'when parsed as XML',
        expect
          .it('to be an', 'XMLDocument')
          .and('to equal', parseXml(xmlSrc))
          .and('queried for first', 'fooBar', 'to have attributes', {
            yes: 'sir'
          })
      );
    });

    it('should provide the parsed document as the fulfillment value when no assertion is provided', () =>
      expect(
        '<?xml version="1.0"?><fooBar yes="sir">foo</fooBar>',
        'parsed as XML'
      ).then(document => {
        expect(document, 'queried for first', 'fooBar', 'to have attributes', {
          yes: 'sir'
        });
      }));

    describe('to satisfy', () => {
      describe('when comparing an array of children', () => {
        it('should succeed with a text child', () => {
          expect(
            [
              '<?xml version="1.0"?>',
              '<content>',
              '  <hello type="greeting">World</hello>',
              '</content>'
            ].join('\n'),
            'when parsed as XML',
            'queried for first',
            'hello',
            'to satisfy',
            {
              attributes: {
                type: 'greeting'
              },
              children: ['World']
            }
          );
        });
      });
    });

    describe('when the DOMParser global is available', () => {
      const OriginalDOMParser = root.DOMParser;
      const safeParseXmlDocument =
        typeof jsdom !== 'undefined'
          ? str =>
              new jsdom.JSDOM(str, { contentType: 'text/xml' }).window.document
          : str =>
              new OriginalDOMParser().parseFromString(str, 'application/xml');

      let DOMParserSpy;
      let parseFromStringSpy;
      beforeEach(() => {
        DOMParser = DOMParserSpy = sinon
          .spy(() => ({
            parseFromString: (parseFromStringSpy = sinon
              .spy(xmlString => safeParseXmlDocument(xmlString))
              .named('parseFromString'))
          }))
          .named('DOMParser');
      });
      afterEach(() => {
        DOMParser = OriginalDOMParser;
      });

      it('should use DOMParser to parse the document', () => {
        expect(
          xmlSrc,
          'when parsed as XML',
          'queried for first',
          'fooBar',
          'to have text',
          'foo'
        );
        expect(
          [DOMParserSpy, parseFromStringSpy],
          'to have calls satisfying',
          () => {
            // eslint-disable-next-line no-new
            new DOMParserSpy();
            parseFromStringSpy(xmlSrc, 'text/xml');
          }
        );
      });
    });
  });

  it('should produce a good satisfy diff in a real world example', () => {
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

    expect(
      () => {
        expect(body.firstChild, 'to satisfy', {
          attributes: {
            style: { display: 'block' },
            class: ['knockout-autocomplete', 'floating-menu']
          },
          children: [
            {
              attributes: { 'data-index': '0', class: 'selected' },
              children: [
                { attributes: { class: 'before' }, children: [] },
                { attributes: { class: 'match' }, children: ['pr'] },
                { attributes: { class: 'after' }, children: ['ivate'] }
              ]
            },
            {
              attributes: { 'data-index': '1', class: undefined },
              children: [
                { attributes: { class: 'before' }, children: [] },
                { attributes: { class: 'match' }, children: ['pr'] },
                { attributes: { class: 'after' }, children: ['odtected'] }
              ]
            }
          ]
        });
      },
      'to throw',
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
        "  attributes: { style: { display: 'block' }, class: [ 'knockout-autocomplete', 'floating-menu' ] },\n" +
        '  children: [ { attributes: ..., children: ... }, { attributes: ..., children: ... } ]\n' +
        '}\n' +
        '\n' +
        '<ul class="knockout-autocomplete menu scrollable floating-menu" style="display: block; bottom: auto; top: 0px; left: 0px">\n' +
        '  <li class="selected" data-index="0">\n' +
        '    <span class="before"></span>\n' +
        '    <strong class="match">...</strong>\n' +
        '    <span class="after">...</span>\n' +
        '  </li>\n' +
        '  <li data-index="1">\n' +
        '    <span class="before"></span>\n' +
        '    <strong class="match">pr</strong>\n' +
        '    <span class="after">\n' +
        "      otected // should equal 'odtected'\n" +
        '              //\n' +
        '              // -otected\n' +
        '              // +odtected\n' +
        '    </span>\n' +
        '  </li>\n' +
        '</ul>'
    );
  });

  it('should compare XML element names case sensitively', () => {
    expect(
      () => {
        expect(parseXml('<foO></foO>').firstChild, 'to satisfy', {
          name: 'foo'
        });
      },
      'to throw',
      "expected <foO></foO> to satisfy { name: 'foo' }\n" +
        '\n' +
        "<foO // should equal 'foo'\n" +
        '></foO>'
    );
  });

  it('should compare XML element names case sensitively, even when the owner document lacks a contentType attribute', () => {
    expect(
      () => {
        const document = parseXml('<foO></foO>');
        document.firstChild._ownerDocument = {
          toString() {
            return '[object XMLDocument]';
          }
        };
        expect(document.firstChild, 'to satisfy', {
          name: 'foo'
        });
      },
      'to throw',
      "expected <foO></foO> to satisfy { name: 'foo' }\n" +
        '\n' +
        "<foO // should equal 'foo'\n" +
        '></foO>'
    );
  });

  it('should compare XML element names case sensitively, even when the owner document lacks a contentType attribute', () => {
    expect(
      () => {
        const document = parseXml('<foO></foO>');
        document.firstChild._ownerDocument = {
          toString() {
            return '[object XMLDocument]';
          }
        };
        expect(document.firstChild, 'to satisfy', {
          name: 'foo'
        });
      },
      'to throw',
      "expected <foO></foO> to satisfy { name: 'foo' }\n" +
        '\n' +
        "<foO // should equal 'foo'\n" +
        '></foO>'
    );
  });

  describe('to contain', () => {
    describe('on a DOMDocument', () => {
      describe('when given a DOMElement', () => {
        it('succeeds if the given structure is present', () => {
          expect(
            '<!DOCTYPE html><html><body><div><i>Hello</i> <span class="name something-else">Jane Doe</span></div></body></html>',
            'when parsed as HTML to contain',
            parseHtmlNode('<span class="name">Jane Doe</span>')
          );
        });
      });
    });

    describe('on a DOMDocumentFragment', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          'when parsed as HTML fragment to contain',
          '<span class="name">Jane Doe</span>'
        );
      });
    });

    describe('on a DOMElement', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          parseHtmlNode(
            '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>'
          ),
          'to contain',
          '<span class="name">Jane Doe</span>'
        );
      });
    });

    describe('on a DOMNodeList', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          '<div>Nothing here</div><div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          'when parsed as HTML fragment',
          'queried for',
          'div',
          'to contain',
          '<span class="name">Jane Doe</span>'
        );
      });
    });

    describe('on an XMLDocument', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          '<?xml version="1.0"?><qux><fooBar yes="sir">foo</fooBar> bax <Quux>baax</Quux></qux>',
          'parsed as XML',
          'to contain',
          '<fooBar yes="sir">foo</fooBar>'
        );
      });
    });

    describe('when given a DOMElement', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          parseHtmlNode('<span class="name">Jane Doe</span>')
        );
      });
    });

    describe('when given a spec', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            name: 'span',
            attributes: { class: 'name' },
            textContent: expect.it('to match', /^Jane/).and('to have length', 8)
          }
        );
      });

      it('supports searching for class names', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            attributes: { class: 'something-else name' }
          }
        );
      });

      it('supports searching for inline-styles by an object', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            attributes: { style: { 'background-color': 'red' } }
          }
        );
      });

      it('supports searching for inline-styles by a string', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            attributes: { style: 'background-color: red' }
          }
        );
      });

      it('supports using regexps on the tag name', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            name: /^(i|span)$/,
            textContent: 'Hello'
          }
        );
      });

      it('supports using expect.it on the tag name', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            name: expect.it('to have length', 1),
            textContent: 'Hello'
          }
        );
      });

      it('supports using regexps on the class name', () => {
        expect(
          '<div><i class="greeting">Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            attributes: {
              class: /^name something/
            }
          }
        );
      });

      it('supports using expect.it on the class name', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          {
            attributes: {
              class: expect.it('to end with', 'else')
            },
            textContent: 'Jane Doe'
          }
        );
      });

      it('supports using declaring that the class should be undefined', () => {
        expect(
          '<div><i class="wat">Hello!</i> <i>Hello</i></div>',
          'when parsed as HTML',
          'to contain',
          {
            attributes: {
              class: undefined
            },
            textContent: 'Hello'
          }
        );
      });

      it('supports searching for boolean attributes', () => {
        expect(
          '<div><i class="greeting">Hello</i> <span class="name something-else and-this">Jane Doe</span> <input type="checkbox" checked="checked"></div>',
          'when parsed as HTML',
          'to contain',
          {
            name: 'input',
            attributes: { checked: true }
          }
        );
      });

      it('supports searching for false boolean attributes', () => {
        expect(
          '<div><input type="checkbox"></div>',
          'when parsed as HTML',
          'to contain',
          {
            name: 'input',
            attributes: { checked: undefined }
          }
        );
      });

      it('supports searching for a child element', () => {
        expect(
          '<div><span class="greeting"><i>Hello</i><!-- comment --></span> Jane Doe</div>',
          'when parsed as HTML',
          'to contain',
          {
            name: 'span',
            children: [
              parseHtmlNode('<i>Hello</i>'),
              parseHtmlNode('<!-- comment -->')
            ]
          }
        );
      });

      it('supports the onlyAttributes flag', () => {
        expect(
          '<div><span class="greeting">Hello</span> Jane Doe</div>',
          'when parsed as HTML',
          'to contain',
          {
            name: 'span',
            attributes: {
              class: 'greeting'
            },
            onlyAttributes: true
          }
        );
      });
    });

    describe('when given a string', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          'when parsed as HTML',
          'to contain',
          '<span class="name">Jane Doe</span>'
        );
      });

      it('fails when given more than on node', () => {
        expect(
          () => {
            expect(
              '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
              'when parsed as HTML',
              'to contain',
              '<span class="name">Jane Doe</span>!'
            );
          },
          'to throw',
          'HTMLElement to contain string: Only a single node is supported'
        );
      });
    });

    it('supports only stating a subset of the classes', () => {
      expect(
        '<div><i class="greeting">Hello</i> <span class="name something-else and-this">Jane Doe</span></div>',
        'when parsed as HTML',
        'to contain',
        '<span class="name and-this">Jane Doe</span>'
      );
    });

    it('supports searching for boolean attributes', () => {
      expect(
        '<div><i class="greeting">Hello</i> <span class="name something-else and-this">Jane Doe</span> <input type="checkbox" checked="checked"></div>',
        'when parsed as HTML',
        'to contain',
        '<input type="checkbox" checked="checked">'
      );
    });

    it('supports searching for style values', () => {
      expect(
        '<div><i style="color: red">Hello</i> <span style="color: blue: background: #bad5aa">Jane Doe</span><em style="background: orange">!</em></div>',
        'when parsed as HTML',
        'to contain',
        '<span style="color: blue">Jane Doe</span>'
      );
    });

    it('takes ignore comments into account when searching children', () => {
      expect(
        '<div><span class="greeting"><span>Hello</span><span class="name">Jane Doe</span></span></div>',
        'when parsed as HTML',
        'to contain',
        '<span><span>Hello</span><!--ignore--></span>'
      );
    });

    it('fails searching for a plain string', () => {
      expect(
        () => {
          expect(
            '<div><span class="greeting"><span>Hello</span><span class="name">Jane Doe</span></span></div>',
            'when parsed as HTML',
            'to contain',
            'Jane Doe'
          );
        },
        'to throw',
        'HTMLElement to contain string: please provide a HTML structure as a string'
      );
    });

    it('fails when matching against an element with no children', () => {
      expect(
        () => {
          expect(
            parseHtmlNode('<div></div>'),
            'to contain',
            '<span>Jane Doe</span>'
          );
        },
        'to throw',
        'expected <div></div> to contain <span>Jane Doe</span>'
      );
    });

    it('should not match directly on the subject', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<span class="greeting"><span>Hello</span><span class="name">Jane Doe</span></span>'
            ),
            'to contain',
            '<span><span>Hello</span><!--ignore--></span>'
          );
        },
        'to throw',
        'expected\n' +
          '<span class="greeting">\n' +
          '  <span>Hello</span>\n' +
          '  <span class="name">Jane Doe</span>\n' +
          '</span>\n' +
          'to contain <span><span>Hello</span><!--ignore--></span>\n' +
          '\n' +
          '<span>\n' +
          "  // missing { name: 'span', attributes: {}, children: [ 'Hello' ] }\n" +
          '  Hello\n' +
          '</span>'
      );
    });

    it('fails without a diff if no good candidates can be found in the given structure', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><div><div><div><div><div></div></div></div></div></div></div>'
            ),
            'to contain',
            '<span class="name">John Doe</span>'
          );
        },
        'to throw',
        'expected <div><div><div><div><div><div></div></div></div></div></div></div>\n' +
          'to contain <span class="name">John Doe</span>'
      );
    });

    it('fails with a diff if the given structure is not present', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>'
            ),
            'to contain',
            '<span class="name">John Doe</span>'
          );
        },
        'to throw',
        'expected\n' +
          '<div>\n' +
          '  <i>Hello</i>\n' +
          '  \n' +
          '  <span class="name something-else">Jane Doe</span>\n' +
          '</div>\n' +
          'to contain <span class="name">John Doe</span>\n' +
          '\n' +
          '<span class="name something-else">\n' +
          "  Jane Doe // should equal 'John Doe'\n" +
          '           //\n' +
          '           // -Jane Doe\n' +
          '           // +John Doe\n' +
          '</span>'
      );
    });

    it('allows tag names to be different while finding the best match', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><i>Hello</i> <span class="name something-else">Jane Doe</span> and <div>John Doe</div></div>'
            ),
            'to contain',
            '<div class="name">Jane Doe</div>'
          );
        },
        'to throw',
        'expected\n' +
          '<div>\n' +
          '  <i>Hello</i>\n' +
          '  \n' +
          '  <span class="name something-else">Jane Doe</span>\n' +
          '  and\n' +
          '  <div>John Doe</div>\n' +
          '</div>\n' +
          'to contain <div class="name">Jane Doe</div>\n' +
          '\n' +
          "<span // should equal 'div'\n" +
          '  class="name something-else"\n' +
          '>Jane Doe</span>'
      );
    });

    it('matches on sub-trees when searching for the best match', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><i>Hello</i> <span class="name something-else"><em>Jane Doe</em></span> and <div>John Doe</div></div>'
            ),
            'to contain',
            '<span class="name"><i>Jane Doe</i></span>'
          );
        },
        'to throw',
        'expected\n' +
          '<div>\n' +
          '  <i>Hello</i>\n' +
          '  \n' +
          '  <span class="name something-else"><em>...</em></span>\n' +
          '  and\n' +
          '  <div>John Doe</div>\n' +
          '</div>\n' +
          'to contain <span class="name"><i>Jane Doe</i></span>\n' +
          '\n' +
          '<span class="name something-else">\n' +
          "  <em // should equal 'i'\n" +
          '  >Jane Doe</em>\n' +
          '</span>'
      );
    });

    it('matches more strongly on ids when showing the best match', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><i>Hello</i> <span data-test-id="name" class="name something-else">Jane Doe</span> and <span class="name">John Doe</span></div>'
            ),
            'to contain',
            '<span data-test-id="name">John Doe</span>'
          );
        },
        'to throw',
        'expected\n' +
          '<div>\n' +
          '  <i>Hello</i>\n' +
          '  \n' +
          '  <span class="name something-else" data-test-id="name">\n' +
          '    Jane Doe\n' +
          '  </span>\n' +
          '  and\n' +
          '  <span class="name">John Doe</span>\n' +
          '</div>\n' +
          'to contain <span data-test-id="name">John Doe</span>\n' +
          '\n' +
          '<span data-test-id="name" class="name something-else">\n' +
          "  Jane Doe // should equal 'John Doe'\n" +
          '           //\n' +
          '           // -Jane Doe\n' +
          '           // +John Doe\n' +
          '</span>'
      );
    });
  });

  describe('not to contain', () => {
    it('succeeds if the given structure is not present', () => {
      expect(
        parseHtmlNode(
          '<div><i>Hello</i> <span data-test-id="name" class="name something-else">Jane Doe</span> and <span class="name">John Doe</span></div>'
        ),
        'not to contain',
        '<span data-test-id="name">John Doe</span>'
      );
    });

    it("succeeds if the given structure doesn't match any descendant elements at all", () => {
      expect(
        parseHtmlNode(
          '<div><div><div><div><div><div></div></div></div></div></div></div>'
        ),
        'not to contain',
        '<span data-test-id="name">John Doe</span>'
      );
    });

    it('succeeds if the element has no children', () => {
      expect(
        parseHtmlNode('<div></div>'),
        'not to contain',
        '<span>Jane Doe</span>'
      );
    });

    it('shows a diff if the given structure is present', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><i>Hello</i> <span data-test-id="name" class="name something-else">Jane Doe</span> and <span class="name">John Doe</span></div>'
            ),
            'not to contain',
            '<span data-test-id="name">Jane Doe</span>'
          );
        },
        'to throw',
        'expected\n' +
          '<div>\n' +
          '  <i>Hello</i>\n' +
          '  \n' +
          '  <span class="name something-else" data-test-id="name">\n' +
          '    Jane Doe\n' +
          '  </span>\n' +
          '  and\n' +
          '  <span class="name">John Doe</span>\n' +
          '</div>\n' +
          'not to contain <span data-test-id="name">Jane Doe</span>\n' +
          '\n' +
          'Found:\n' +
          '\n' +
          '<span class="name something-else" data-test-id="name">\n' +
          '  Jane Doe\n' +
          '</span>'
      );
    });
  });
});
