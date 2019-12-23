/* global expect, jsdom, DOMParser:true */
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
