/* global expect, jsdom, DOMParser */

const parseHtmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'text/html')
    : (str) => new jsdom.JSDOM(str).window.document;

describe('"to contain elements matching" assertion', () => {
  it('should pass when matching an element', () => {
    const document = parseHtmlDocument(
      '<!DOCTYPE html><html><body><div class="foo"></div></body></html>',
    );

    expect(document, 'to contain elements matching', '.foo');
  });

  it('should fail when no elements match', () => {
    const document = parseHtmlDocument(
      '<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>',
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
    `,
    );
  });

  describe('with the "not" flag', () => {
    it('should pass when not matching anything', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body></body></html>',
      );

      expect(document, 'not to contain elements matching', '.foo');
    });

    it('should fail when matching a single node', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div></body></html>',
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
      `,
      );
    });

    it('should fail when matching a NodeList', () => {
      const document = parseHtmlDocument(
        '<!DOCTYPE html><html><body><div class="foo"></div><div class="foo"></div></body></html>',
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
      `,
      );
    });
  });
});
