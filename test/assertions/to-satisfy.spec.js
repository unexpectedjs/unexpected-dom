/* global expect, jsdom, DOMParser */

const isIe =
  window.navigator &&
  /Windows/.test(window.navigator.userAgent) &&
  /Trident\//.test(window.navigator.userAgent);

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

function parseHtmlNode(str) {
  return parseHtmlFragment(str).childNodes[0];
}

describe('"to satisfy" assertion', () => {
  let body;

  it.skipIf = function (bool, descr, block) {
    (bool ? it.skip : it)(descr, block);
  };

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

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
                draggable: 'true',
              },
            },
          ],
        });
      });

      it('should allow "false"', () => {
        body.innerHTML = '<div draggable="false"></div>';
        expect(body, 'to satisfy', {
          children: [
            {
              attributes: {
                draggable: 'false',
              },
            },
          ],
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
                    draggable: false,
                  },
                },
              ],
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
            children: 'foo<span>bar</span>',
          },
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
                children: '<span>bar</span>foo',
              },
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
      it('should succeed', () => {
        expect(
          '<div class="bar">foo</div>',
          'when parsed as HTML fragment to exhaustively satisfy',
          '<div class="bar">foo</div>'
        );
      });

      it('should fail with a diff when comparing node lists', () => {
        expect(
          () => {
            expect(
              '<div class="guide-markup"><p class="wysiwyg-color-red130 guide-markup">Something</p></div><div class="guide-markup"><div class="guide-markup"><img class="some-existing-class guide-markup" src="image.png"></div></div>',
              'when parsed as HTML to exhaustively satisfy',
              '<div class="guide-markup"><p class="guide-markup wysiwyg-color-red130">Something</p></div><div class="guide-markup"><div class="guide-markup"><img src="image.png" class="guide-markup" /></div></div>'
            );
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
            expected '<div class="guide-markup"><p class="wysiwyg-color-red130 guide-markup">Something</p></div><div class="guide-markup"><div class="guide-markup"><img class="some-existing-class guide-markup" src="image.png"></div></div>'
            when parsed as HTML to exhaustively satisfy '<div class="guide-markup"><p class="guide-markup wysiwyg-color-red130">Something</p></div><div class="guide-markup"><div class="guide-markup"><img src="image.png" class="guide-markup" /></div></div>'
              expected <html><head></head><body>...</body></html>
              to exhaustively satisfy '<div class="guide-markup"><p class="guide-markup wysiwyg-color-red130">Something</p></div><div class="guide-markup"><div class="guide-markup"><img src="image.png" class="guide-markup" /></div></div>'

              <html>
                <head></head>
                <body>
                  <div class="guide-markup">
                    <p class="wysiwyg-color-red130 guide-markup">...</p>
                  </div>
                  <div class="guide-markup">
                    <div class="guide-markup">
                      <img
                        class="some-existing-class guide-markup" // expected [ 'guide-markup', 'some-existing-class' ] to equal [ 'guide-markup' ]
                                                                 //
                                                                 // [
                                                                 //   'guide-markup',
                                                                 //   'some-existing-class' // should be removed
                                                                 // ]
                        src="image.png"
                      >
                    </div>
                  </div>
                </body>
              </html>
          `
        );
      });

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
              '<div>baz</div>',
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
              '<div>baz</div>',
            ].join('\n'),
            'when parsed as HTML fragment to satisfy',
            parseHtmlFragment(
              [
                '<div>foo</div>',
                '<div><!--ignore--></div>',
                '<div>baz</div>',
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
            { name: 'div', children: ['bar'] },
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
                { name: 'div', children: ['bar'] },
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
            1: { name: 'div', children: ['bar'] },
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
                1: { name: 'div', children: ['bar'] },
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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

    it('should not fail for a shorthand style attribute on the RHS', () => {
      expect(
        parseHtml('<div style="border: 2px dashed #960FD4;">hey</div>'),
        'to satisfy',
        parseHtml('<div style="border: 2px dashed #960FD4;">hey</div>')
      );
    });

    it.skipIf(isIe, 'should fail when the RHS has invalid styles', () =>
      expect(
        () =>
          expect(
            parseHtml('<div style="width: 120px;">hey</div>'),
            'to satisfy',
            parseHtml('<div style="color;background;width: 120px">hey</div>')
          ),
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
        'to throw an error satisfying to equal snapshot',
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
      const xmlDoc = parseXmlDocument(
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
      const node = parseHtml('<span></span>');
      node.innerHTML = '<div foo="bar">hey</div>';
      body.innerHTML = '<div><div foo="bar">hey</div></div>';
      expect(body.firstChild, 'to satisfy', {
        children: [node.firstChild],
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
        const commentNode = parseHtml('<!-- ignore -->');
        body.innerHTML = '<div><span>ignore</span><span>important</span></div>';
        expect(body.firstChild, 'to satisfy', {
          children: [
            commentNode,
            {
              children: 'important',
            },
          ],
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
          1: { attributes: { foo: 'bar' } },
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

  describe('XMLDocument', () => {
    it('should compare XML element names case sensitively', () => {
      expect(
        () => {
          expect(parseXmlDocument('<foO></foO>').firstChild, 'to satisfy', {
            name: 'foo',
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
          const document = parseXmlDocument('<foO></foO>');
          document.firstChild._ownerDocument = {
            toString() {
              return '[object XMLDocument]';
            },
          };
          expect(document.firstChild, 'to satisfy', {
            name: 'foo',
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

    describe('with an array as the value', () => {
      it('should succeed with a text child', () => {
        expect(
          parseXmlDocument(
            [
              '<?xml version="1.0"?>',
              '<content>',
              '  <hello type="greeting">World</hello>',
              '</content>',
            ].join('\n')
          ),
          'queried for first',
          'hello',
          'to satisfy',
          {
            attributes: {
              type: 'greeting',
            },
            children: ['World'],
          }
        );
      });
    });
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
        name: expect.it((value) => value.indexOf('-').length === 2),
      });
    });

    it('succeeds when used as the children option', () => {
      expect(
        parseHtmlNode(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>'
        ),
        'to satisfy',
        {
          children: expect.it('to have length', 3),
        }
      );
    });

    it('succeeds when used as the textContent option', () => {
      expect(parseHtmlNode('<div>bar foo</div>'), 'to satisfy', {
        textContent: expect.it('not to start with', 'foo'),
      });
    });
  });

  describe('when used in a real world example', () => {
    it('should produce a good satisfy diff (text)', () => {
      const element = parseHtml(
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
          '</ul>'
      );

      expect(
        () => {
          expect(element, 'to satisfy', {
            attributes: {
              style: { display: 'block' },
              class: ['knockout-autocomplete', 'floating-menu'],
            },
            children: [
              {
                attributes: { 'data-index': '0', class: 'selected' },
                children: [
                  { attributes: { class: 'before' }, children: [] },
                  { attributes: { class: 'match' }, children: ['pr'] },
                  { attributes: { class: 'after' }, children: ['ivate'] },
                ],
              },
              {
                attributes: { 'data-index': '1', class: undefined },
                children: [
                  { attributes: { class: 'before' }, children: [] },
                  { attributes: { class: 'match' }, children: ['pr'] },
                  { attributes: { class: 'after' }, children: ['odtected'] },
                ],
              },
            ],
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

    it('should produce a good satisfy diff (html)', () => {
      const element = parseHtml(
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
          '</ul>'
      );

      expect(
        () => {
          expect(element, 'to satisfy', {
            attributes: {
              style: { display: 'block' },
              class: ['knockout-autocomplete', 'floating-menu'],
            },
            children: [
              {
                attributes: { 'data-index': '0', class: 'selected' },
                children: [
                  { attributes: { class: 'before' }, children: [] },
                  { attributes: { class: 'match' }, children: ['pr'] },
                  { attributes: { class: 'after' }, children: ['ivate'] },
                ],
              },
              {
                attributes: { 'data-index': '1', class: undefined },
                children: [
                  { attributes: { class: 'before' }, children: [] },
                  { attributes: { class: 'match' }, children: ['pr'] },
                  { attributes: { class: 'after' }, children: ['odtected'] },
                ],
              },
            ],
          });
        },
        'to throw',
        expect.it((error) => {
          const message = error.getErrorMessage('html').toString();

          expect(
            message,
            'to equal snapshot',
            '<div style="font-family: monospace; white-space: nowrap"><div><span style="color: red; font-weight: bold">expected</span></div><div><span style="color: #999">&lt;</span><span style="color: #905">ul&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">knockout-autocomplete&nbsp;menu&nbsp;scrollable&nbsp;floating-menu</span><span style="color: #999">&quot;</span><span style="color: #905">&nbsp;</span><span style="color: #690">style</span><span style="color: #999">=&quot;</span><span style="color: #905">left</span><span style="color: #999">:</span>&nbsp;0px<span style="color: #999">;</span>&nbsp;<span style="color: #905">top</span><span style="color: #999">:</span>&nbsp;0px<span style="color: #999">;</span>&nbsp;<span style="color: #905">bottom</span><span style="color: #999">:</span>&nbsp;auto<span style="color: #999">;</span>&nbsp;<span style="color: #905">display</span><span style="color: #999">:</span>&nbsp;block<span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">li&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">selected</span><span style="color: #999">&quot;</span><span style="color: #905">&nbsp;</span><span style="color: #690">data-index</span><span style="color: #999">=&quot;</span><span style="color: #07a">0</span><span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">before</span><span style="color: #999">&quot;&gt;&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">strong&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">match</span><span style="color: #999">&quot;&gt;</span>...<span style="color: #999">&lt;/</span><span style="color: #905">strong</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">after</span><span style="color: #999">&quot;&gt;</span>...<span style="color: #999">&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">li</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">li&nbsp;</span><span style="color: #690">data-index</span><span style="color: #999">=&quot;</span><span style="color: #07a">1</span><span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">before</span><span style="color: #999">&quot;&gt;&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">strong&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">match</span><span style="color: #999">&quot;&gt;</span>...<span style="color: #999">&lt;/</span><span style="color: #905">strong</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">after</span><span style="color: #999">&quot;&gt;</span>...<span style="color: #999">&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">li</span><span style="color: #999">&gt;</span></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">ul</span><span style="color: #999">&gt;</span></div><div><span style="color: red; font-weight: bold">to&nbsp;satisfy</span></div><div>{</div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #555">attributes</span>:&nbsp;{&nbsp;<span style="color: #555">style</span>:&nbsp;{&nbsp;<span style="color: #555">display</span>:&nbsp;<span style="color: #df5000">\'block\'</span>&nbsp;},&nbsp;<span style="color: #555">class</span>:&nbsp;[&nbsp;<span style="color: #df5000">\'knockout-autocomplete\'</span>,&nbsp;<span style="color: #df5000">\'floating-menu\'</span>&nbsp;]&nbsp;},</div><div><span style="color: #555">children</span>:&nbsp;[&nbsp;{&nbsp;<span style="color: #555">attributes</span>:&nbsp;...,&nbsp;<span style="color: #555">children</span>:&nbsp;...&nbsp;},&nbsp;{&nbsp;<span style="color: #555">attributes</span>:&nbsp;...,&nbsp;<span style="color: #555">children</span>:&nbsp;...&nbsp;}&nbsp;]</div></div></div><div>}</div><div>&nbsp;</div><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">ul</span>&nbsp;<span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">knockout-autocomplete&nbsp;menu&nbsp;scrollable&nbsp;floating-menu</span><span style="color: #999">&quot;</span>&nbsp;<span style="color: #690">style</span><span style="color: #999">=&quot;</span><span style="color: #07a">left:&nbsp;0px;&nbsp;top:&nbsp;0px;&nbsp;bottom:&nbsp;auto;&nbsp;display:&nbsp;block</span><span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">li&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">selected</span><span style="color: #999">&quot;</span><span style="color: #905">&nbsp;</span><span style="color: #690">data-index</span><span style="color: #999">=&quot;</span><span style="color: #07a">0</span><span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">before</span><span style="color: #999">&quot;&gt;&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">strong&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">match</span><span style="color: #999">&quot;&gt;</span>...<span style="color: #999">&lt;/</span><span style="color: #905">strong</span><span style="color: #999">&gt;</span></div></div></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">after</span><span style="color: #999">&quot;&gt;</span>...<span style="color: #999">&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">li</span><span style="color: #999">&gt;</span></div></div></div></div></div><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">li</span>&nbsp;<span style="color: #690">data-index</span><span style="color: #999">=&quot;</span><span style="color: #07a">1</span><span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">before</span><span style="color: #999">&quot;&gt;&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div></div></div><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">strong&nbsp;</span><span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">match</span><span style="color: #999">&quot;&gt;</span>pr<span style="color: #999">&lt;/</span><span style="color: #905">strong</span><span style="color: #999">&gt;</span></div></div></div></div></div><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span</span>&nbsp;<span style="color: #690">class</span><span style="color: #999">=&quot;</span><span style="color: #07a">after</span><span style="color: #999">&quot;&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div><div style="display: inline-block; vertical-align: top"><div>otected&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: red; font-weight: bold">//</span></div><div><span style="color: red; font-weight: bold">//</span></div><div><span style="color: red; font-weight: bold">//</span></div><div><span style="color: red; font-weight: bold">//</span></div></div>&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: red; font-weight: bold">should&nbsp;equal</span>&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #df5000">\'odtected\'</span></div></div></div><div>&nbsp;</div><div><span style="background-color: red; color: white">otected</span></div><div><span style="background-color: green; color: white">odtected</span></div></div></div></div></div></div></div></div></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div></div></div></div></div></div></div></div></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">li</span><span style="color: #999">&gt;</span></div></div></div></div></div></div></div></div></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">ul</span><span style="color: #999">&gt;</span></div></div></div></div>'
          );
        })
      );
    });

    it('should produce a good satisfy diff (html with nested assertion)', () => {
      const expectWithExtra = expect
        .clone()
        .addAssertion(
          '<DOMElement> with an empty span injected <assertion>',
          (expect, subject) => {
            subject.innerHTML = '<span></span>';
            return expect.shift(subject);
          }
        );

      expect(
        () => {
          expectWithExtra(
            parseHtml('<div></div>'),
            'with an empty span injected',
            'to satisfy',
            { textContent: 'foo' }
          );
        },
        'to throw',
        expect.it((error) => {
          const message = error.getErrorMessage('html').toString();
          expect(
            message,
            'to equal', // not using snapshot to demonstrate an issue with the env var
            '<div style="font-family: monospace; white-space: nowrap"><div><span style="color: red; font-weight: bold">expected</span>&nbsp;<span style="color: #999">&lt;</span><span style="color: #905">div</span><span style="color: #999">&gt;&lt;</span><span style="color: #905">span</span><span style="color: #999">&gt;&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;&lt;/</span><span style="color: #905">div</span><span style="color: #999">&gt;</span>&nbsp;<span style="color: red; font-weight: bold">with&nbsp;an&nbsp;empty&nbsp;span&nbsp;injected</span>&nbsp;<span style="color: red; font-weight: bold">to&nbsp;satisfy</span>&nbsp;{&nbsp;<span style="color: #555">textContent</span>:&nbsp;<span style="color: #df5000">\'foo\'</span>&nbsp;}</div><div>&nbsp;</div><div><div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">div</span><span style="color: #999">&gt;</span></div><div>&nbsp;&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: #999">&lt;</span><span style="color: #905">span</span><span style="color: #999">&gt;&lt;/</span><span style="color: #905">span</span><span style="color: #999">&gt;</span></div><div>&nbsp;</div></div>&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: red; font-weight: bold">//</span></div><div><span style="color: red; font-weight: bold">//</span></div><div><span style="color: red; font-weight: bold">//</span></div></div>&nbsp;<div style="display: inline-block; vertical-align: top"><div><span style="color: red; font-weight: bold">expected</span>&nbsp;<span style="color: #df5000">\'\'</span>&nbsp;<span style="color: red; font-weight: bold">to&nbsp;equal</span>&nbsp;<span style="color: #df5000">\'foo\'</span></div><div>&nbsp;</div><div><span style="color: green">foo</span></div></div></div><div><span style="color: #999">&lt;/</span><span style="color: #905">div</span><span style="color: #999">&gt;</span></div></div></div></div>'
          );
        })
      );
    });
  });
});
