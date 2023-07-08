/* global expect, jsdom */

describe('"to have text" assertion', () => {
  let body;

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

  it('should succeed', () => {
    body.innerHTML = '<div>foo</div>';

    expect(body, 'to have text', 'foo');
  });

  it('should fail with a diff', () => {
    body.innerHTML = '<div>foo</div>';

    return expect(
      () => {
        expect(body, 'to have text', 'bar');
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <body><div>foo</div></body> to have text 'bar'

      -foo
      +bar
    `,
    );
  });

  it('should use "to satisfy" semantics', () => {
    body.innerHTML = '<div>foo</div>';

    expect(body, 'to have text', /fo/);
  });
});
