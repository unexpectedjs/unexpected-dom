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
    subject = subject.map((item) =>
      typeof item === 'string' ? parseHtml(item) : item
    );
    expect(expect.diff(subject[0], subject[1]).toString(), 'to equal', value);
  }
);

const root = typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;

const parseHtmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'text/html')
    : (str) => new jsdom.JSDOM(str).window.document;

const parseXmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'application/xml')
    : (str) =>
        new jsdom.JSDOM(str, { contentType: 'text/xml' }).window.document;

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

describe('unexpected-dom', () => {
  expect.output.preferredWidth = 100;

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

  describe('focus handling', () => {
    let button;

    beforeEach(() => {
      button = root.document.createElement('button');
      root.document.body.appendChild(button);
    });

    afterEach(() => {
      button.parentNode.removeChild(button);
    });

    it('should show a :focus indicator on a focused element', () => {
      button.focus();

      expect(button, 'to inspect as', '<button :focus></button>');
    });

    it('should not show a :focus indicator on a focused <body>', () => {
      const body = button.parentNode;

      body.focus();

      expect(expect.inspect(body).toString(), 'to begin with', '<body>');
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
          '<div title="the same" class="there" id="bar" data-something="identical"></div>',
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
            '<div>foo<i>blah</i></div><span>bark</span>',
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
    const theDocument = parseHtmlDocument('');
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
        id: 'foo',
      });
    });

    it('should provide the results as the fulfillment value when no assertion is provided', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div id="foo"></div></body></html>'
      );
      return expect(document, 'queried for first', 'div').then((div) => {
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
              id: 'foo',
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
        id: 'foo',
      });
    });

    it('should provide the results as the fulfillment value when no assertion is provided', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div data-test-id="foo" id="foo"></div></body></html>'
      );
      return expect(document, 'queried for test id', 'foo').then((div) => {
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
            class: 'bar',
          })
      );
    });

    it('should provide the parsed document as the fulfillment value when no assertion is provided', () =>
      expect(htmlSrc, 'parsed as HTML').then((document) => {
        expect(document, 'to equal', parseHtmlDocument(htmlSrc));
      }));

    describe('with the "fragment" flag', () => {
      it('should return a DocumentFragment instance', () => {
        expect(
          '<div>foo</div><div>bar</div>',
          'when parsed as HTML fragment',
          expect.it('to be a', 'DOMDocumentFragment').and('to satisfy', [
            { name: 'div', children: ['foo'] },
            { name: 'div', children: ['bar'] },
          ])
        );
      });

      it('should provide the parsed fragment as the fulfillment value when no assertion is provided', () =>
        expect('<div>foo</div><div>bar</div>', 'parsed as HTML fragment').then(
          (fragment) => {
            expect(fragment, 'to satisfy', [
              { children: 'foo' },
              { children: 'bar' },
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
              },
            },
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

    it('should parse a string as a complete XML document (attributes)', () => {
      expect(
        xmlSrc,
        'when parsed as XML',
        expect
          .it('to be an', 'XMLDocument')
          .and('to equal', parseXmlDocument(xmlSrc))
          .and('queried for first', 'fooBar', 'to have attributes', {
            yes: 'sir',
          })
      );
    });

    it('should parse a string as a complete XML document (text)', () => {
      expect(
        xmlSrc,
        'when parsed as XML',
        'queried for first',
        'fooBar',
        'to have text',
        'foo'
      );
    });

    it('should provide the parsed document as the fulfillment value when no assertion is provided', () =>
      expect(xmlSrc, 'parsed as XML').then((document) => {
        expect(document, 'queried for first', 'fooBar', 'to have attributes', {
          yes: 'sir',
        });
      }));

    describe('when the DOMParser global is available', () => {
      const OriginalDOMParser = root.DOMParser;
      let seenDomParserArgs;

      beforeEach(() => {
        seenDomParserArgs = null;
        DOMParser = class DOMParser {
          parseFromString(str) {
            seenDomParserArgs = [str];
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
          () =>
            expect(
              xmlSrc,
              'when parsed as XML',
              expect.it('to be an', 'XMLDocument')
            ),
          'to be fulfilled'
        ).then(() => {
          expect(seenDomParserArgs, 'to equal', [xmlSrc]);
        });
      });
    });
  });
});
