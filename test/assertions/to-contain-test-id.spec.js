/* global expect, jsdom, DOMParser */

const parseHtmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'text/html')
    : (str) => new jsdom.JSDOM(str).window.document;

describe('"to contain test id" assertion', () => {
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

  describe('with the "not" flag', () => {
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
});
