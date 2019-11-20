/* global expect, jsdom, DOMParser:true */
const isIe =
  window.navigator &&
  /Windows/.test(window.navigator.userAgent) &&
  /Trident\//.test(window.navigator.userAgent);

it.skipIf = function(bool, descr, block) {
  (bool ? it.skip : it)(descr, block);
};

expect.addAssertion(
  '<function> to error satisfying <assertion>',
  (expect, cb) =>
    expect(cb, 'to error').then(err => {
      expect.errorMode = 'nested';
      return expect.shift(
        err.isUnexpected ? err.getErrorMessage('text').toString() : err.message
      );
    })
);

expect.addAssertion(
  '<function> to throw an error satisfying <assertion>',
  (expect, cb) =>
    expect(cb, 'to throw').then(err => {
      expect.errorMode = 'nested';
      return expect.shift(
        err.isUnexpected ? err.getErrorMessage('text').toString() : err.message
      );
    })
);

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
      'to inspect as snapshot',
      '<!DOCTYPE html><html><head></head><body></body></html>'
    );
  });

  it('should inspect an XML document correctly', () => {
    expect(
      '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>',
      'when parsed as XML',
      'to inspect as snapshot',
      '<?xml version="1.0"?><fooBar>abc<source></source></fooBar>'
    );
  });

  it('should inspect a document with nodes around the documentElement correctly', () => {
    expect(
      '<!DOCTYPE html><!--foo--><html><head></head><body></body></html><!--bar-->',
      'when parsed as HTML',
      'to inspect as snapshot',
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
        'to equal snapshot',
        expect.unindent`
          <div>
            <div id="foo"></div>
            <div id="bar" // should equal 'quux'
            ></div>
          </div>
        `
      );
    });

    it('should work with HTMLElement with text nodes and comments inside', () => {
      expect(
        '<div>foo<!--bar--></div>',
        'diffed with',
        '<div>quux<!--baz--></div>',
        'to equal snapshot',
        expect.unindent`
          <div>
            -foo
            +quux
            -<!--bar-->
            +<!--baz-->
          </div>
        `
      );
    });

    it('should report a missing child correctly', () => {
      expect(
        '<div>foo<!--bar--></div>',
        'diffed with',
        '<div>foo<span></span><!--bar--></div>',
        'to equal snapshot',
        expect.unindent`
          <div>
            foo
            // missing <span></span>
            <!--bar-->
          </div>
        `
      );
    });

    it('should report an extraneous child correctly', () => {
      expect(
        '<div>foo<span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<!--bar--></div>',
        'to equal snapshot',
        expect.unindent`
          <div>
            foo
            <span></span> // should be removed
            <!--bar-->
          </div>
        `
      );
    });

    it('should produce a nested diff when the outer elements are identical', () => {
      expect(
        '<div>foo<span><span>foo</span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<span><span>bar</span></span><!--bar--></div>',
        'to equal snapshot',
        expect.unindent`
          <div>
            foo
            <span>
              <span>
                -foo
                +bar
              </span>
            </span>
            <!--bar-->
          </div>
        `
      );
    });

    it('should produce a nested diff when the outer element has a different set of attributes', () => {
      expect(
        '<div>foo<span class="bar" id="foo"><span>foo</span></span><!--bar--></div>',
        'diffed with',
        '<div>foo<span><span>bar</span></span><!--bar--></div>',
        'to equal snapshot',
        expect.unindent`
          <div>
            foo
            <span class="bar" // should be removed
                  id="foo" // should be removed
            >
              <span>
                -foo
                +bar
              </span>
            </span>
            <!--bar-->
          </div>
        `
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
        'to equal snapshot',
        expect.unindent`
          <!DOCTYPE html>
          <!--foo--> // should be removed
          <html><head></head><body></body></html>
          <!--bar--> // should be removed
        `
      );
    });

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
          '<div title="the same" class="hey" id="foo" data-something="identical"></div>',
          '<div title="the same" class="there" id="bar" data-something="identical"></div>'
        ],
        'to produce a diff of',
        '<div title="the same" class="hey" // should equal \'there\'\n' +
          '     id="foo" // should equal \'bar\'\n' +
          '     data-something="identical"></div>'
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
              expected '<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>'
              when parsed as HTML to satisfy <!DOCTYPE html><html><head></head><body class="foo"></body></html>
                expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>
                to satisfy <!DOCTYPE html><html><head></head><body class="foo"></body></html>

                <!DOCTYPE html>
                <html>
                  <head></head>
                  <body
                    class="bar" // expected [ 'bar' ] to contain 'foo'
                  >
                    foo // should be removed
                  </body>
                </html>
            `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<!DOCTYPE html><html><head></head><body class="bar">foo</body></html>'
            when parsed as HTML to satisfy '<!DOCTYPE html><html><head></head><body class="foo"></body></html>'
              expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>
              to satisfy '<!DOCTYPE html><html><head></head><body class="foo"></body></html>'

              <!DOCTYPE html>
              <html>
                <head></head>
                <body
                  class="bar" // expected [ 'bar' ] to contain 'foo'
                >
                  foo // should be removed
                </body>
              </html>
          `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <body><div>foo</div></body> to have text 'bar'

        -foo
        +bar
      `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <button>Press me</button> to have class 'foo'

        <button
          // missing class should satisfy 'foo'
        >Press me</button>
      `
      );
    });

    describe('with a single class passed as a string', () => {
      it('should succeed', () => {
        body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        expect(body.firstChild, 'to have class', 'bar');
      });

      it('should fail with a diff', () => {
        body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'to have class', 'quux');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to have class 'quux'

          <button
            disabled
            class="bar" // expected [ 'bar' ] to contain 'quux'
            id="foo"
            data-info="baz"
          >Press me</button>
        `
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
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'to have classes', ['quux', 'bar']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to have classes [ 'quux', 'bar' ]

          <button
            disabled
            class="bar" // expected [ 'bar' ] to contain 'quux', 'bar'
            id="foo"
            data-info="baz"
          >Press me</button>
        `
        );
      });
    });

    describe('with the "not" flag', () => {
      describe('with a single class passed as a string', () => {
        it('should succeed', () => {
          body.innerHTML =
            '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
          expect(body.firstChild, 'not to have class', 'foo');
        });

        it('should fail with a diff', () => {
          body.innerHTML =
            '<button disabled class="bar quux" id="foo" data-info="baz">Press me</button>';
          expect(
            () => {
              expect(body.firstChild, 'not to have class', 'quux');
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected
            <button disabled class="bar quux" id="foo" data-info="baz">
              Press me
            </button>
            not to have class 'quux'

            <button
              disabled
              class="bar quux" // expected [ 'bar', 'quux' ] not to contain 'quux'
                               //
                               // [
                               //   'bar',
                               //   'quux' // should be removed
                               // ]
              id="foo"
              data-info="baz"
            >Press me</button>
          `
          );
        });
      });
    });

    describe('with the "only" flag', () => {
      describe('with a single class passed as a string', () => {
        it('should succeed', () => {
          body.innerHTML =
            '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
          expect(body.firstChild, 'to only have class', 'bar');
        });

        it('should fail with a diff', () => {
          body.innerHTML =
            '<button disabled class="bar quux" id="foo" data-info="baz">Press me</button>';
          expect(
            () => {
              expect(body.firstChild, 'to only have class', 'quux');
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected
            <button disabled class="bar quux" id="foo" data-info="baz">
              Press me
            </button>
            to only have class 'quux'

            <button
              disabled
              class="bar quux" // expected [ 'bar', 'quux' ] to equal [ 'quux' ]
                               //
                               // [
                               //   'bar', // should be removed
                               //   'quux'
                               // ]
              id="foo"
              data-info="baz"
            >Press me</button>
          `
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
            '<button disabled class="bar quux foo" id="foo" data-info="baz">Press me</button>';
          expect(
            () => {
              expect(body.firstChild, 'to only have classes', ['quux', 'bar']);
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected
            <button disabled class="bar quux foo" id="foo" data-info="baz">
              Press me
            </button>
            to only have classes [ 'bar', 'quux' ]

            <button
              disabled
              class="bar quux foo" // expected [ 'bar', 'foo', 'quux' ] to equal [ 'bar', 'quux' ]
                                   //
                                   // [
                                   //   'bar',
                                   //   'foo', // should be removed
                                   //   'quux'
                                   // ]
              id="foo"
              data-info="baz"
            >Press me</button>
          `
          );
        });
      });
    });
  });

  describe('to have attributes', () => {
    describe('argument comparison', () => {
      it('should match exact arguments', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

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
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to only have attributes', 'id');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to only have attributes 'id'

          <button
            disabled // should be removed
            class="bar" // should be removed
            id="foo"
            data-info="baz" // should be removed
          >Press me</button>
        `
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
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', 'id', 'foo');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to have attributes 'id', 'foo'

          <button
            disabled
            class="bar"
            id="foo"
            data-info="baz"
            // missing foo
          >Press me</button>
        `
        );
      });
    });

    describe('array comparison', () => {
      it('should match exact arguments', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', [
          'id',
          'class',
          'data-info',
          'disabled'
        ]);
      });

      it('should fail on exact arguments not met', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to only have attributes', ['id']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to only have attributes [ 'id' ]

          <button
            disabled // should be removed
            class="bar" // should be removed
            id="foo"
            data-info="baz" // should be removed
          >Press me</button>
        `
        );
      });

      it('should match partial arguments', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

        expect(this.body.firstChild, 'to have attributes', ['id', 'class']);
      });

      it('should fail on partial arguments not met', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', ['id', 'foo']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to have attributes [ 'id', 'foo' ]

          <button
            disabled
            class="bar"
            id="foo"
            data-info="baz"
            // missing foo
          >Press me</button>
        `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <button id="foo" quux="baz">Press me</button> to have attributes { quux: undefined }

            <button
              id="foo"
              quux="baz" // should be removed
            >Press me</button>
          `
          );
        });
      });
    });

    describe('object comparison', () => {
      it('should match exact object', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', {
          id: 'foo',
          class: 'bar',
          'data-info': 'baz',
          disabled: true
        });
      });

      it('should fail on exact object not satisfied', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to only have attributes', {
              id: 'foo'
            });
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to only have attributes { id: 'foo' }

          <button
            disabled // should be removed
            class="bar" // should be removed
            id="foo"
            data-info="baz" // should be removed
          >Press me</button>
        `
        );
      });

      it('should match partial object', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

        expect(this.body.firstChild, 'to have attributes', {
          id: 'foo',
          class: 'bar'
        });
      });

      it('should fail on partial object not satisfied', function() {
        this.body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', {
              id: 'foo',
              foo: 'bar'
            });
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar" id="foo" data-info="baz">
            Press me
          </button>
          to have attributes { id: 'foo', foo: 'bar' }

          <button
            disabled
            class="bar"
            id="foo"
            data-info="baz"
            // missing foo should equal 'bar'
          >Press me</button>
        `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i class="bar"></i> to have attributes { class: 'foo bar baz' }

            <i
              class="bar" // expected [ 'bar' ] to contain 'foo', 'bar', 'baz'
            ></i>
          `
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
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected <i class="foo bar baz"></i> to only have attributes { class: 'foo baz' }

              <i
                class="foo bar baz" // expected [ 'bar', 'baz', 'foo' ] to equal [ 'baz', 'foo' ]
                                    //
                                    // [
                                    //   'bar', // should equal 'baz'
                                    //          //
                                    //          // -bar
                                    //          // +baz
                                    //   'baz', // should be removed
                                    //   'foo'
                                    // ]
              ></i>
            `
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
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected <i class="foo baz"></i> to only have attributes { class: 'foo bar baz' }

              <i
                class="foo baz" // expected [ 'baz', 'foo' ] to equal [ 'bar', 'baz', 'foo' ]
                                //
                                // [
                                //   'baz', // should equal 'bar'
                                //          //
                                //          // -baz
                                //          // +bar
                                //   // missing 'baz'
                                //   'foo'
                                // ]
              ></i>
            `
            );
          });
        });
      });

      describe('style attribute', () => {
        describe('lax comparison', () => {
          it('should do string comparisons', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should do string comparisons in any order', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should do string comparisons on partial values', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

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
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected <i style="color: red"></i> to have attributes { style: 'background: blue' }

              <i
                style="color: red" // expected { color: 'red' } to satisfy { background: 'blue' }
                                   //
                                   // {
                                   //   color: 'red'
                                   //   // missing background: 'blue'
                                   // }
              ></i>
            `
            );
          });

          it('should do object comparisons', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

            expect(this.body.firstChild, 'to have attributes', {
              style: {
                color: 'red',
                background: 'blue'
              }
            });
          });

          it('should do partial object comparisons', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

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
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected <i style="color: red"></i> to have attributes { style: { background: 'blue' } }

              <i
                style="color: red" // expected { color: 'red' } to satisfy { background: 'blue' }
                                   //
                                   // {
                                   //   color: 'red'
                                   //   // missing background: 'blue'
                                   // }
              ></i>
            `
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

          it('should handle url values', function() {
            this.body.innerHTML =
              '<div style="background: url(https://www.example.com/picture.png)"></div>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: {
                background: expect
                  .it('to be', 'url(https://www.example.com/picture.png)')
                  .or('to be', 'url("https://www.example.com/picture.png")')
              }
            });
          });
        });

        describe('strict comparison', () => {
          it('should do string comparisons', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should do string comparisons in any order', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: 'background: blue; color: red'
            });
          });

          it('should fail when styles are missing', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';
            const node = this.body.firstChild;

            expect(
              () => {
                expect(node, 'to only have attributes', {
                  style: 'background: blue'
                });
              },
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected <i style="background: blue; color: red"></i>
              to only have attributes { style: 'background: blue' }

              <i
                style="background: blue; color: red" // expected { background: 'blue', color: 'red' } to exhaustively satisfy { background: 'blue' }
                                                     //
                                                     // {
                                                     //   background: 'blue',
                                                     //   color: 'red' // should be removed
                                                     // }
              ></i>
            `
            );
          });

          it('should do object comparisons', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';

            expect(this.body.firstChild, 'to only have attributes', {
              style: {
                color: 'red',
                background: 'blue'
              }
            });
          });

          it('should fail on missing partial object comparisons', function() {
            this.body.innerHTML =
              '<i style="background: blue; color: red"></i>';
            const node = this.body.firstChild;

            expect(
              () => {
                expect(node, 'to only have attributes', {
                  style: {
                    background: 'blue'
                  }
                });
              },
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected <i style="background: blue; color: red"></i>
              to only have attributes { style: { background: 'blue' } }

              <i
                style="background: blue; color: red" // expected { background: 'blue', color: 'red' } to exhaustively satisfy { background: 'blue' }
                                                     //
                                                     // {
                                                     //   background: 'blue',
                                                     //   color: 'red' // should be removed
                                                     // }
              ></i>
            `
            );
          });
        });
      });
    });
  });

  describe('not to have attributes', () => {
    describe('when given one of more strings', () => {
      it('should pass if the given element does not have any the provided attribute names', () => {
        body.innerHTML = '<div style="background: blue; color: red" />';
        const node = body.firstChild;

        expect(node, 'not to have attributes', 'data-test-id', 'class');
      });

      it('should fail if the given element has one of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', 'data-test-id', 'class');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red"></div>
          not to have attributes 'data-test-id', 'class'

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
          ></div>
        `
        );
      });

      it('should fail if the given element has multiple of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red" data-test-id="my-div"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', 'data-test-id', 'class');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red" data-test-id="my-div"></div>
          not to have attributes 'data-test-id', 'class'

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
            data-test-id="my-div" // should be removed
          ></div>
        `
        );
      });
    });

    describe('when given an array', () => {
      it('should pass if the given element does not have any of the provided attribute names', () => {
        body.innerHTML = '<div style="background: blue; color: red" />';
        const node = body.firstChild;

        expect(node, 'not to have attributes', ['data-test-id', 'class']);
      });

      it('should fail if the given element has one of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', ['data-test-id', 'class']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red"></div>
          not to have attributes [ 'data-test-id', 'class' ]

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
          ></div>
        `
        );
      });

      it('should fail if the given element has multiple of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red" data-test-id="my-div"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', ['data-test-id', 'class']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red" data-test-id="my-div"></div>
          not to have attributes [ 'data-test-id', 'class' ]

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
            data-test-id="my-div" // should be removed
          ></div>
        `
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
          'to throw an error satisfying to equal snapshot',
          'expected <div><p></p></div> to have no children'
        );
      });

      it('should fail on element with HTMLComment children', function() {
        this.body.innerHTML = '<div><!-- Comment --></div>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have no children');
          },
          'to throw an error satisfying to equal snapshot',
          'expected <div><!-- Comment --></div> to have no children'
        );
      });

      it('should fail on element with TextNode children', function() {
        this.body.innerHTML = '<div>I am a text</div>';
        const el = this.body.firstChild;

        expect(
          () => {
            expect(el, 'to have no children');
          },
          'to throw an error satisfying to equal snapshot',
          'expected <div>I am a text</div> to have no children'
        );
      });
    });
  });

  describe('to equal', () => {
    describe('on HTML elements', () => {
      it('should succeeds if they are equal', () => {
        expect(
          parseHtmlNode(
            '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
          ),
          'to equal',
          parseHtmlNode(
            '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
          )
        );
      });

      it('should fail if they are not equal', () => {
        expect(
          () => {
            expect(
              parseHtmlNode(
                '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
              ),
              'to equal',
              parseHtmlNode(
                '<ul><li>John</li><li>Jane</li><li class="winner">Annie</li></ul>'
              )
            );
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
            expected <ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>
            to equal <ul><li>John</li><li>Jane</li><li class="winner">Annie</li></ul>

            <ul>
              <li>John</li>
              <li class="winner" // should be removed
              >
                Jane
              </li>
              <li // missing class="winner"
              >
                Annie
              </li>
            </ul>
          `
        );
      });
    });

    describe('on DOM document fragments', () => {
      it('should succeeds if they are equal', () => {
        expect(
          parseHtmlFragment(
            '<h1>Tournament</h1><ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
          ),
          'to equal',
          parseHtmlFragment(
            '<h1>Tournament</h1><ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
          )
        );
      });

      it('should fail if they are not equal', () => {
        expect(
          () => {
            expect(
              parseHtmlFragment(
                '<h1>Tournament</h1><ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
              ),
              'to equal',
              parseHtmlFragment(
                '<h1>Tournament</h1><ul><li>John</li><li>Jane</li><li class="winner">Annie</li></ul>'
              )
            );
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          DocumentFragment[NodeList[
            <h1>Tournament</h1>,
            <ul><li>...</li><li class="winner">...</li><li>...</li></ul>
          ]]
          to equal
          DocumentFragment[NodeList[
            <h1>Tournament</h1>,
            <ul><li>...</li><li>...</li><li class="winner">...</li></ul>
          ]]

          <h1>Tournament</h1>
          <ul>
            <li>John</li>
            <li class="winner" // should be removed
            >
              Jane
            </li>
            <li // missing class="winner"
            >
              Annie
            </li>
          </ul>
        `
        );
      });
    });

    describe('on text nodes', () => {
      it('should succeeds if they are equal', () => {
        expect(parseHtml('text'), 'to equal', parseHtml('text'));
      });

      it('should fail if they are not equal', () => {
        expect(
          () => {
            expect(parseHtml('text'), 'to equal', parseHtml('hext'));
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected text to equal hext

          -text
          +hext
        `
        );
      });
    });

    describe('on node lists', () => {
      it('should succeeds if they are equal', () => {
        expect(
          parseHtmlFragment('<div>one</div><div>two</div><div>three</div>')
            .childNodes,
          'to equal',
          parseHtmlFragment('<div>one</div><div>two</div><div>three</div>')
            .childNodes
        );
      });

      it('should fail if they are not equal', () => {
        expect(
          () => {
            expect(
              parseHtmlFragment('<div>one</div><div>two</div><div>three</div>')
                .childNodes,
              'to equal',
              parseHtmlFragment('<div>1</div><div>2</div><div>3</div>')
                .childNodes
            );
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected NodeList[ <div>one</div>, <div>two</div>, <div>three</div> ]
          to equal NodeList[ <div>1</div>, <div>2</div>, <div>3</div> ]

          NodeList[
            <div>
              -one
              +1
            </div>,
            <div>
              -two
              +2
            </div>,
            <div>
              -three
              +3
            </div>
          ]
        `
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
        'to throw an error satisfying to equal snapshot',
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <body><div draggable></div></body> to satisfy { children: [ { attributes: ... } ] }

            <body>
              <div
                draggable="true" // Invalid expected value false. Supported values include: 'true', 'false'
              ></div>
            </body>
          `
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
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <body><div foo="bar">foobarquux</div></body> to satisfy { textContent: 'fooquux' }

          <body>
            <div foo="bar">foobarquux</div> // expected 'foobarquux' to equal 'fooquux'
                                            //
                                            // -foobarquux
                                            // +fooquux
          </body>
        `
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
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected '<div foo="bar">foo<span>bar</span></div>'
          when parsed as HTML fragment to satisfy [ { name: 'div', children: '<span>bar</span>foo' } ]
            expected DocumentFragment[NodeList[ <div foo="bar">foo<span>...</span></div> ]]
            to satisfy [ { name: 'div', children: '<span>bar</span>foo' } ]

            NodeList[
              <div foo="bar">
                ┌─▷
                │   foo
                └── <span>bar</span> // should be moved
              </div>
            ]
        `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div>foo</div><div>bar</div>'
            when parsed as HTML fragment to satisfy '<div>quux</div><div baz="quux">bar</div>'
              expected DocumentFragment[NodeList[ <div>foo</div>, <div>bar</div> ]]
              to satisfy <div>quux</div><div baz="quux">bar</div>

              NodeList[
                <div>
                  foo // should equal quux
                      //
                      // -foo
                      // +quux
                </div>,
                <div
                  // missing baz should equal 'quux'
                >bar</div>
              ]
          `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div foo="bar" baz="quux">foo</div><div>bar</div>'
            when parsed as HTML fragment to exhaustively satisfy '<div foo="bar">foo</div><div>bar</div>'
              expected DocumentFragment[NodeList[ <div foo="bar" baz="quux">foo</div>, <div>bar</div> ]]
              to exhaustively satisfy <div foo="bar">foo</div><div>bar</div>

              NodeList[
                <div
                  foo="bar"
                  baz="quux" // should be removed
                >foo</div>,
                <div>bar</div>
              ]
          `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div>foo</div><div>bar</div>'
            when parsed as HTML fragment to satisfy DocumentFragment[NodeList[ <div>quux</div>, <div baz="quux">bar</div> ]]
              expected DocumentFragment[NodeList[ <div>foo</div>, <div>bar</div> ]]
              to satisfy DocumentFragment[NodeList[ <div>quux</div>, <div baz="quux">bar</div> ]]

              NodeList[
                <div>
                  foo // should equal quux
                      //
                      // -foo
                      // +quux
                </div>,
                <div
                  // missing baz should equal 'quux'
                >bar</div>
              ]
          `
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
              'to throw an error satisfying to equal snapshot',
              expect.unindent`
              expected '<div foo="bar">foo</div><div><div>bar</div></div><div>baz</div>'
              when parsed as HTML fragment to satisfy DocumentFragment[NodeList[ <div foo="bar">foo!</div>, <!--ignore-->, <div>baz</div> ]]
                expected DocumentFragment[NodeList[ <div foo="bar">foo</div>, <div><div>...</div></div>, <div>baz</div> ]]
                to satisfy DocumentFragment[NodeList[ <div foo="bar">foo!</div>, <!--ignore-->, <div>baz</div> ]]

                NodeList[
                  <div foo="bar">
                    foo // should equal foo!
                        //
                        // -foo
                        // +foo!
                  </div>,
                  <div><div>...</div></div>,
                  <div>baz</div>
                ]
            `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div foo="baz">foo</div><div>foobar</div>' when parsed as HTML fragment
            to satisfy [
              { attributes: { foo: 'bar' }, children: [ 'foo' ] },
              { name: 'div', children: [ 'bar' ] }
            ]
              expected DocumentFragment[NodeList[ <div foo="baz">foo</div>, <div>foobar</div> ]] to satisfy
              [
                { attributes: { foo: 'bar' }, children: [ 'foo' ] },
                { name: 'div', children: [ 'bar' ] }
              ]

              NodeList[
                <div
                  foo="baz" // expected 'baz' to equal 'bar'
                            //
                            // -baz
                            // +bar
                >foo</div>,
                <div>
                  foobar // should equal 'bar'
                         //
                         // -foobar
                         // +bar
                </div>
              ]
          `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div foo="baz">foo</div><div>foobar</div>'
            when parsed as HTML fragment to satisfy { 1: { name: 'div', children: [ 'bar' ] } }
              expected DocumentFragment[NodeList[ <div foo="baz">foo</div>, <div>foobar</div> ]]
              to satisfy { 1: { name: 'div', children: [ 'bar' ] } }

              NodeList[
                <div foo="baz">foo</div>,
                <div>
                  foobar // should equal 'bar'
                         //
                         // -foobar
                         // +bar
                </div>
              ]
          `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div foo="bar">foo</div><div>bar</div>' when parsed as HTML fragment to satisfy /foo/
              expected DocumentFragment[NodeList[ <div foo="bar">foo</div>, <div>bar</div> ]] to satisfy /foo/
          `
          );
        });
      });

      describe('with an element as value', () => {
        it('should fail without a diff', () => {
          expect(
            () => {
              expect(
                '<div>foo</div><div>bar</div>',
                'when parsed as HTML fragment to satisfy',
                parseHtmlNode('<div>foo</div>')
              );
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected '<div>foo</div><div>bar</div>' when parsed as HTML fragment to satisfy <div>foo</div>
              expected DocumentFragment[NodeList[ <div>foo</div>, <div>bar</div> ]] to satisfy <div>foo</div>
          `
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

      it('should succeed when the subject equals the value parsed as HTML, except an extra attribute', () =>
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
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div foo="bar">hey</div> to satisfy <div bar="quux">hey</div>

            <div
              foo="bar"
              // missing bar should equal 'quux'
            >hey</div>
          `
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
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div class="foo">hey</div> to satisfy <div class="bar">hey</div>

            <div
              class="foo" // expected [ 'foo' ] to contain 'bar'
            >hey</div>
          `
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
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div style="width: 120px">hey</div> to satisfy <div style="color: tan;">hey</div>

            <div
              style="width: 120px" // expected { width: '120px' } to satisfy { color: 'tan' }
                                   //
                                   // {
                                   //   width: '120px'
                                   //   // missing color: 'tan'
                                   // }
            >hey</div>
          `
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
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div foo="bar" baz="quux">foobar</div> to satisfy <div foo="bar" baz="quux">hey</div>

            <div foo="bar" baz="quux">
              foobar // should equal hey
                     //
                     // -foobar
                     // +hey
            </div>
          `
        ));

      it('should succeed when the subject equals the value', () =>
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
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div foo="bar">hey</div> to satisfy <div bar="quux">hey</div>

            <div
              foo="bar"
              // missing bar should equal 'quux'
            >hey</div>
          `
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
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div class="foo">hey</div> to satisfy <div class="bar">hey</div>

            <div
              class="foo" // expected [ 'foo' ] to contain 'bar'
            >hey</div>
          `
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

      it.skipIf(isIe, 'should fail when the RHS has invalid styles', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="border-left-color: #FFF">hey</div>'),
              'to satisfy',
              parseHtml('<div style="border-left-color: #FFFF;">hey</div>')
            ),
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div style="border-left-color: #FFF">hey</div>
            to satisfy <div style="border-left-color: #FFFF">hey</div>

            <div
              style="border-left-color: #FFF" // expected <div style="border-left-color: #FFF">hey</div>
                                              // to satisfy { name: 'div', attributes: { style: 'border-left-color: #FFFF;' }, children: [ hey ] }
                                              //   Expectation contains invalid styles: 'border-left-color: #FFFF'
            >hey</div>
          `
        )
      );

      it.skipIf(isIe, 'should fail when the RHS has invalid styles', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="width: 120px;">hey</div>'),
              'to satisfy',
              parseHtml('<div style="color;background;width: 120px">hey</div>')
            ),
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div style="width: 120px">hey</div> to satisfy <div style="width: 120px">hey</div>

            <div
              style="width: 120px" // expected <div style="width: 120px">hey</div>
                                   // to satisfy { name: 'div', attributes: { style: 'color;background;width: 120px' }, children: [ hey ] }
                                   //   Expectation contains invalid styles: 'color;background'
            >hey</div>
          `
        )
      );

      it('should fail when the subject is missing an inline style', () =>
        expect(
          () =>
            expect(
              parseHtml('<div style="width: 120px;">hey</div>'),
              'to satisfy',
              parseHtml('<div style="color: tan;">hey</div>')
            ),
          'to error satisfying to equal snapshot',
          expect.unindent`
            expected <div style="width: 120px">hey</div> to satisfy <div style="color: tan">hey</div>

            <div
              style="width: 120px" // expected { width: '120px' } to satisfy { color: 'tan' }
                                   //
                                   // {
                                   //   width: '120px'
                                   //   // missing color: 'tan'
                                   // }
            >hey</div>
          `
        ));
    });

    describe('HTMLElement with DOMDocumentFragment as value', () => {
      it('should fail without a diff', () => {
        expect(
          () => {
            expect(
              parseHtml('<div>foo</div>'),
              'to satisfy',
              parseHtmlFragment('<div>foo</div><div>bar</div>')
            );
          },
          'to throw an error satisfying to equal snapshot',
          'expected <div>foo</div> to satisfy DocumentFragment[NodeList[ <div>foo</div>, <div>bar</div> ]]'
        );
      });
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
          'to error satisfying to equal snapshot',
          expect.unindent`
          expected foobar to satisfy bar

          -foobar
          +bar
        `
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
          'to error satisfying to equal snapshot',
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
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div foo="bar"></div> to satisfy { name: /^sp/ }

          <div // should match /^sp/
            foo="bar"
          ></div>
        `
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
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <fooBar hey="there"></fooBar> to satisfy { name: 'fooBarQuux' }

            <fooBar // should equal 'fooBarQuux'
              hey="there"
            ></fooBar>
          `
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
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div foo="bar">hey</div> to satisfy { children: [ 'there' ] }

          <div foo="bar">
            hey // should equal 'there'
                //
                // -hey
                // +there
          </div>
        `
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
        '<div id="quux" foo="bar">foobar</div><div foo="quux">hey</div>';
      expect(
        () => {
          expect(body, 'queried for', 'div', 'to satisfy', {
            1: { attributes: { foo: 'bar' } }
          });
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <body>
          <div id="quux" foo="bar">foobar</div>
          <div foo="quux">hey</div>
        </body>
        queried for div to satisfy { 1: { attributes: { foo: 'bar' } } }
          expected NodeList[ <div id="quux" foo="bar">foobar</div>, <div foo="quux">hey</div> ]
          to satisfy { 1: { attributes: { foo: 'bar' } } }

          NodeList[
            <div id="quux" foo="bar">foobar</div>,
            <div
              foo="quux" // expected 'quux' to equal 'bar'
                         //
                         // -quux
                         // +bar
            >hey</div>
          ]
      `
      );
    });

    // Regression test for https://github.com/unexpectedjs/unexpected-dom/issues/294
    it('should produce a nice diff when satisfying a test node against an element with children', () => {
      expect(
        () =>
          expect(
            parseHtmlNode('<div>foo</div>'),
            'to satisfy',
            '<div><div><div>bar</div></div></div>'
          ),
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div>foo</div> to satisfy <div><div><div>bar</div></div></div>

        <div>
          foo // should satisfy <div><div>bar</div></div>
        </div>
      `
      );
    });

    describe('when used with expect.it', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          parseHtmlNode('<div class="foobar"></div>'),
          'to satisfy',
          expect.it('to have attributes', 'class')
        );
      });

      it('fails with a diff if the given structure is absent', () => {
        expect(
          () =>
            expect(
              parseHtmlNode('<div></div>'),
              'to satisfy',
              expect.it('to have attributes', 'class')
            ),
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
            expected <div></div> to have attributes 'class'

            <div
              // missing class
            ></div>
          `
        );
      });

      it('succeeds with a negated assertion', () => {
        expect(
          parseHtmlNode('<div></div>'),
          'to satisfy',
          expect.it('not to have attributes', 'class')
        );
      });

      it('succeeds when used as the name option', () => {
        expect(parseHtmlNode('<my-foo-bar></my-foo-bar>'), 'to satisfy', {
          name: expect.it(value => value.indexOf('-').length === 2)
        });
      });

      it('succeeds when used as the children option', () => {
        expect(
          parseHtmlNode(
            '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>'
          ),
          'to satisfy',
          {
            children: expect.it('to have length', 3)
          }
        );
      });

      it('succeeds when used as the textContent option', () => {
        expect(parseHtmlNode('<div>bar foo</div>'), 'to satisfy', {
          textContent: expect.it('not to start with', 'foo')
        });
      });
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <body><div id="foo"></div></body> queried for first .blabla to have attributes { id: 'foo' }
          The selector .blabla yielded no results
      `
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
            {
              id: 'foo'
            }
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <body><div id="foo"></div></body> queried for .blabla to have attributes { id: 'foo' }
          The selector .blabla yielded no results
      `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <!DOCTYPE html><html><head></head><body>...</body></html> queried for div to have length 1
          expected NodeList[ <div></div>, <div></div>, <div></div> ] to have length 1
            expected 3 to be 1
      `
      );
    });
  });

  describe('queried for test id', () => {
    it('should work with HTMLDocument', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo" id="foo"></div></body></html>'
      );
      expect(document, 'queried for test id', 'foo', 'to have attributes', {
        id: 'foo'
      });
    });

    it('should provide the results as the fulfillment value when no assertion is provided', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo" id="foo"></div></body></html>'
      );
      return expect(document, 'queried for test id', 'foo').then(div => {
        expect(div, 'to have attributes', { id: 'foo' });
      });
    });

    it('should error out if the selector matches no elements', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(
            document.body,
            'queried for test id',
            'blabla',
            'to have attributes',
            { id: 'foo' }
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected <body><div data-test-id="foo"></div></body>
          queried for test id 'blabla' to have attributes { id: 'foo' }
            expected DOMElement queried for first [data-test-id="blabla"]
              The selector [data-test-id="blabla"] yielded no results
        `
      );
    });
  });

  describe('not to contain elements matching', () => {
    it('should pass when not matching anything', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body></body></html>'
      );

      expect(document, 'not to contain elements matching', '.foo');
    });

    it('should fail when matching a single node', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'not to contain elements matching', '.foo');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <!DOCTYPE html><html><head></head><body>...</body></html>
        not to contain elements matching '.foo'

        NodeList[
          <div class="foo"></div> // should be removed
        ]
      `
      );
    });

    it('should fail when matching a NodeList', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'not to contain elements matching', '.foo');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <!DOCTYPE html><html><head></head><body>...</body></html>
        not to contain elements matching '.foo'

        NodeList[
          <div class="foo"></div>, // should be removed
          <div class="foo"></div> // should be removed
        ]
      `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <!DOCTYPE html><html>
          <head></head>
          <body><div class="foo"></div><div class="foo"></div></body>
        </html>
        to contain elements matching '.bar'
      `
      );
    });
  });

  describe('to contain test id', () => {
    it('should pass when the test id is found', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(document, 'to contain test id', 'foo');
    });

    it('should fail when the test id is not found', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div><div data-test-id="bar"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'to contain test id', 'baz');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected <!DOCTYPE html><html><head></head><body>...</body></html> to contain test id 'baz'
            expected HTMLDocument to contain elements matching '[data-test-id="baz"]'
        `
      );
    });
  });

  describe('not to contain test id', () => {
    it('should pass when the test id is not found ', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body></body></html>'
      );

      expect(document, 'not to contain test id', 'foo');
    });

    it('should fail when the test id is found', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document, 'not to contain test id', 'foo');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected <!DOCTYPE html><html><head></head><body>...</body></html> not to contain test id 'foo'
            expected HTMLDocument not to contain elements matching '[data-test-id="foo"]'

            NodeList[
              <div data-test-id="foo"></div> // should be removed
            ]
        `
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
        'expected <div class="foo"></div> not to match \'.foo\''
      );
    });
  });

  describe('to have test id', () => {
    it('should pass if the element have the given test id', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(document.body.firstChild, 'to have test id', 'foo');
    });

    it('should fail if the element does not have the given test id', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document.body.firstChild, 'to have test id', 'bar');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div data-test-id="foo"></div> to have test id 'bar'
          expected <div data-test-id="foo"></div> to match '[data-test-id="bar"]'
      `
      );
    });
  });

  describe('not to have test id', () => {
    it('should pass if the element does not have the given test id', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(document.body.firstChild, 'not to have test id', 'bar');
    });

    it('should fail if the element have the given test id', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo"></div></body></html>'
      );

      expect(
        () => {
          expect(document.body.firstChild, 'not to have test id', 'foo');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div data-test-id="foo"></div> not to have test id 'foo'
          expected <div data-test-id="foo"></div> not to match '[data-test-id="foo"]'
      `
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
          expect.it('to be a', 'DOMDocumentFragment').and('to satisfy', [
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected '<!DOCTYPE html><html><body class="bar">foo</body></html>'
        when parsed as HTML queried for first 'body' to have attributes { class: 'quux' }
          expected <!DOCTYPE html><html><head></head><body class="bar">...</body></html>
          queried for first body to have attributes { class: 'quux' }
            expected <body class="bar">foo</body> to have attributes { class: 'quux' }

            <body
              class="bar" // expected [ 'bar' ] to contain 'quux'
            >foo</body>
      `
      );
    });

    describe('when the DOMParser global is available', () => {
      const OriginalDOMParser = root.DOMParser;

      beforeEach(() => {
        DOMParser = class DOMParser {
          parseFromString(htmlString) {
            return typeof jsdom !== 'undefined'
              ? new jsdom.JSDOM(htmlString).window.document
              : new OriginalDOMParser().parseFromString(
                  htmlString,
                  'text/html'
                );
          }
        };
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
      });
    });

    if (typeof jsdom !== 'undefined') {
      describe('when the document global is available', () => {
        const originalDocument = root.document;
        const originalDOMParser = root.DOMParser;

        beforeEach(() => {
          DOMParser = undefined; // force the "implementation" path

          // eslint-disable-next-line no-global-assign
          document = {
            implementation: {
              createHTMLDocument() {
                return parseHtmlDocument(htmlSrc);
              }
            }
          };
        });

        afterEach(() => {
          DOMParser = originalDOMParser;
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

      beforeEach(() => {
        DOMParser = class DOMParser {
          parseFromString(str) {
            return typeof jsdom !== 'undefined'
              ? new jsdom.JSDOM(str, { contentType: 'text/xml' }).window
                  .document
              : new OriginalDOMParser().parseFromString(str, 'application/xml');
          }
        };
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
      });
    });
  });

  it('should produce a good satisfy diff in a real world example', () => {
    body.innerHTML =
      '<ul class="knockout-autocomplete menu scrollable floating-menu" style="left: 0px; top: 0px; bottom: auto; display: block">' +
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
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected
      <ul class="knockout-autocomplete menu scrollable floating-menu" style="left: 0px; top: 0px; bottom: auto; display: block">
        <li class="selected" data-index="0">
          <span class="before"></span>
          <strong class="match">...</strong>
          <span class="after">...</span>
        </li>
        <li data-index="1">
          <span class="before"></span>
          <strong class="match">...</strong>
          <span class="after">...</span>
        </li>
      </ul>
      to satisfy
      {
        attributes: { style: { display: 'block' }, class: [ 'knockout-autocomplete', 'floating-menu' ] },
        children: [ { attributes: ..., children: ... }, { attributes: ..., children: ... } ]
      }

      <ul class="knockout-autocomplete menu scrollable floating-menu" style="left: 0px; top: 0px; bottom: auto; display: block">
        <li class="selected" data-index="0">
          <span class="before"></span>
          <strong class="match">...</strong>
          <span class="after">...</span>
        </li>
        <li data-index="1">
          <span class="before"></span>
          <strong class="match">pr</strong>
          <span class="after">
            otected // should equal 'odtected'
                    //
                    // -otected
                    // +odtected
          </span>
        </li>
      </ul>
    `
    );
  });

  it('should compare XML element names case sensitively', () => {
    expect(
      () => {
        expect(parseXml('<foO></foO>').firstChild, 'to satisfy', {
          name: 'foo'
        });
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <foO></foO> to satisfy { name: 'foo' }

      <foO // should equal 'foo'
      ></foO>
    `
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
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <foO></foO> to satisfy { name: 'foo' }

      <foO // should equal 'foo'
      ></foO>
    `
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
          'to throw an error satisfying to equal snapshot',
          'HTMLElement to contain string: Only a single node is supported'
        );
      });
    });

    describe('when used with expect.it', () => {
      it('fails with an unsupported message at the top-level', () => {
        expect(
          () => {
            expect(
              parseHtmlNode('<div></div>'),
              'to contain',
              expect.it('not to have attributes', 'class')
            );
          },
          'to throw',
          'Unsupported value for "to contain" assertion: expect.it'
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
        '<div><i style="color: red">Hello</i> <span style="color: blue; background: #bad5aa">Jane Doe</span><em style="background: orange">!</em></div>',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <span class="greeting">
          <span>Hello</span>
          <span class="name">Jane Doe</span>
        </span>
        to contain <span><span>Hello</span><!--ignore--></span>

        <span>
          // missing <span>Hello</span>
          Hello
        </span>
      `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div><div><div><div><div><div></div></div></div></div></div></div>
        to contain <span class="name">John Doe</span>
      `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected
          <div>
            <i>Hello</i>

            <span class="name something-else">Jane Doe</span>
          </div>
          to contain <span class="name">John Doe</span>

          <span class="name something-else">
            Jane Doe // should equal John Doe
                     //
                     // -Jane Doe
                     // +John Doe
          </span>
        `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected
          <div>
            <i>Hello</i>

            <span class="name something-else">Jane Doe</span>
            and
            <div>John Doe</div>
          </div>
          to contain <div class="name">Jane Doe</div>

          <span // should equal 'div'
            class="name something-else"
          >Jane Doe</span>
        `
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
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected
          <div>
            <i>Hello</i>

            <span class="name something-else"><em>...</em></span>
            and
            <div>John Doe</div>
          </div>
          to contain <span class="name"><i>Jane Doe</i></span>

          <span class="name something-else">
            <em // should equal 'i'
            >Jane Doe</em>
          </span>
        `
      );
    });

    it('matches more strongly on ids when showing the best match', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><i>Hello</i> <span class="name something-else" data-test-id="name">Jane Doe</span> and <span class="name">John Doe</span></div>'
            ),
            'to contain',
            '<span data-test-id="name">John Doe</span>'
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected
          <div>
            <i>Hello</i>

            <span class="name something-else" data-test-id="name">
              Jane Doe
            </span>
            and
            <span class="name">John Doe</span>
          </div>
          to contain <span data-test-id="name">John Doe</span>

          <span class="name something-else" data-test-id="name">
            Jane Doe // should equal John Doe
                     //
                     // -Jane Doe
                     // +John Doe
          </span>
        `
      );
    });

    it('fails if the children is expected but the target is empty', () => {
      expect(
        () => {
          expect(
            parseHtmlNode('<div><span></span></div>'),
            'to contain',
            '<span><i>Hello</i></span>'
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div><span></span></div> to contain <span><i>Hello</i></span>

        <span>
          // missing <i>Hello</i>
        </span>
      `
      );
    });

    it('fails if the an ignored child is expected but the target is empty', () => {
      expect(
        () => {
          expect(
            parseHtmlNode('<div><span></span></div>'),
            'to contain',
            '<span><!-- ignore --></span>'
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div><span></span></div> to contain <span><!-- ignore --></span>

        <span>
          // missing <!-- ignore -->
        </span>
      `
      );
    });

    it('fails if more children is expected than what is available in the target', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><span><strong>Hello</strong><em>world</em></span></div>'
            ),
            'to contain',
            '<span><strong>Hello</strong><!-- ignore -->!</span>'
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div><span><strong>...</strong><em>...</em></span></div>
        to contain <span><strong>Hello</strong><!-- ignore -->!</span>

        <span>
          <strong>Hello</strong>
          <em>world</em>
          // missing !
        </span>
      `
      );
    });

    it('fails if less children is expected than what is available in the target', () => {
      expect(
        () => {
          expect(
            parseHtmlNode(
              '<div><span><strong>Hello</strong><em>world</em>!</span></div>'
            ),
            'to contain',
            '<span><strong>Hello</strong><em>world</em></span>'
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected <div><span><strong>...</strong><em>...</em>!</span></div>
        to contain <span><strong>Hello</strong><em>world</em></span>

        <span>
          <strong>Hello</strong>
          <em>world</em>
          ! // should be removed
        </span>
      `
      );
    });
  });

  describe('not to contain', () => {
    it('succeeds if the given structure is not present', () => {
      expect(
        parseHtmlNode(
          '<div><i>Hello</i> <span class="name something-else" data-test-id="name">Jane Doe</span> and <span class="name">John Doe</span></div>'
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
              '<div><i>Hello</i> <span class="name something-else" data-test-id="name">Jane Doe</span> and <span class="name">John Doe</span></div>'
            ),
            'not to contain',
            '<span data-test-id="name">Jane Doe</span>'
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected
          <div>
            <i>Hello</i>

            <span class="name something-else" data-test-id="name">
              Jane Doe
            </span>
            and
            <span class="name">John Doe</span>
          </div>
          not to contain <span data-test-id="name">Jane Doe</span>

          Found:

          <span class="name something-else" data-test-id="name">
            Jane Doe
          </span>
        `
      );
    });
  });
});
