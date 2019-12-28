/* global expect, jsdom, DOMParser */

const parseHtmlDocument =
  typeof DOMParser !== 'undefined'
    ? str => new DOMParser().parseFromString(str, 'text/html')
    : str => new jsdom.JSDOM(str).window.document;

describe('"to have test id" assertion', () => {
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
});
