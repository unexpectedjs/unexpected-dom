/* global expect, jsdom */

describe('"to have focus" assertion', () => {
  let body;

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

  it('should verify that an element is focused', () => {
    body.innerHTML = '<button>Press me</button>';

    body.firstChild.focus();

    expect(body.firstChild, 'to have focus');
  });

  it('should fail when an element is not focused', () => {
    body.innerHTML = '<button>Press me</button>';

    expect(
      () => {
        expect(body.firstChild, 'to have focus');
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`expected <button>Press me</button> to have focus`
    );
  });

  it('should verify that an element is not focused', () => {
    body.innerHTML = '<button>Press me</button>';

    expect(body.firstChild, 'not to have focus');
  });

  it('should fail when an element is focused', () => {
    body.innerHTML = '<button>Press me</button>';

    body.firstChild.focus();

    expect(
      () => {
        expect(body.firstChild, 'not to have focus');
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`expected <button :focus>Press me</button> not to have focus`
    );
  });
});
