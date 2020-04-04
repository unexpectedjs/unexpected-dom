/* global expect, jsdom, DOMParser */

describe('"to equal" assertion', () => {
  const parseHtmlDocument =
    typeof jsdom !== 'undefined'
      ? (str) => new jsdom.JSDOM(str).window.document
      : (str) => new DOMParser().parseFromString(str, 'text/html');

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

  describe('on HTML elements', () => {
    it('should succeeds if they are equal', () => {
      expect(
        parseHtml(
          '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
        ),
        'to equal',
        parseHtml(
          '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
        )
      );
    });

    it('should fail if they are not equal', () => {
      expect(
        () => {
          expect(
            parseHtml(
              '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
            ),
            'to equal',
            parseHtml(
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

  describe('on DOM documents', () => {
    it('should succeeds if they are equal', () => {
      expect(
        parseHtmlDocument(
          '<!DOCTYPE html><html><body><h1>Tournament</h1><ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul></body></html>'
        ),
        'to equal',
        parseHtmlDocument(
          '<!DOCTYPE html><html><body><h1>Tournament</h1><ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul></body></html>'
        )
      );
    });

    it('should fail if they are not equal', () => {
      expect(
        () => {
          expect(
            parseHtmlDocument(
              '<!DOCTYPE html><html><body><h1>Tournament</h1><ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul></body></html>'
            ),
            'to equal',
            parseHtmlDocument(
              '<!DOCTYPE html><html><body><h1>Tournament</h1><ul><li>John</li><li>Jane</li><li class="winner">Annie</li></ul></body></html>'
            )
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected <!DOCTYPE html><html><head></head><body>...</body></html>
          to equal <!DOCTYPE html><html><head></head><body>...</body></html>

          <!DOCTYPE html>
          <html>
            <head></head>
            <body>
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
            </body>
          </html>
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

    describe('on nodes of different types', () => {
      it('should fail', () => {
        expect(
          () => {
            expect(
              parseHtml(
                '<ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>'
              ),
              'to equal',
              parseHtmlDocument(
                '<!DOCTYPE html><html><body><h1>Tournament</h1><ul><li>John</li><li>Jane</li><li class="winner">Annie</li></ul></body></html>'
              )
            );
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
            expected <ul><li>John</li><li class="winner">Jane</li><li>Annie</li></ul>
            to equal <!DOCTYPE html><html><head></head><body>...</body></html>


          `
        );
      });
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
            parseHtmlFragment('<div>1</div><div>2</div><div>3</div>').childNodes
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
