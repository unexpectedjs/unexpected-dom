/* global expect, jsdom, DOMParser */

const parseHtmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'text/html')
    : (str) => new jsdom.JSDOM(str).window.document;

describe('"to match" assertion', () => {
  it('should match an element correctly', () => {
    const document = parseHtmlDocument(
      '<!DOCTYPE html><html><body><div class="foo"></div></body></html>',
    );

    expect(document.body.firstChild, 'to match', '.foo');
  });

  it('should fail on matching element with a non-matching selector', () => {
    const document = parseHtmlDocument(
      '<!DOCTYPE html><html><body><div class="foo"></div></body></html>',
    );

    expect(
      () => {
        expect(document.body.firstChild, 'to match', '.bar');
      },
      'to throw an error satisfying to equal snapshot',
      'expected <div class="foo"></div> to match \'.bar\'',
    );
  });

  it("should not match an element that doesn't match the selector", () => {
    const document = parseHtmlDocument(
      '<!DOCTYPE html><html><body><div class="foo"></div></body></html>',
    );

    expect(document.body.firstChild, 'not to match', '.bar');
  });

  it('should fail when matching with a selector that was not expected to match', () => {
    const document = parseHtmlDocument(
      '<!DOCTYPE html><html><body><div class="foo"></div></body></html>',
    );

    expect(
      () => {
        expect(document.body.firstChild, 'not to match', '.foo');
      },
      'to throw an error satisfying to equal snapshot',
      'expected <div class="foo"></div> not to match \'.foo\'',
    );
  });
});
