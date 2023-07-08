/* global expect, jsdom */

describe('"to contain focused element matching" assertion', () => {
  let body;

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

  it('should verify that a contained element is focused', () => {
    body.innerHTML = '<button>Press me</button>';

    body.firstChild.focus();

    expect(body, 'to contain focused element matching', 'button');
  });

  it('should fail when selected element is not focused', () => {
    body.innerHTML = '<button>Press me</button>';

    expect(
      () => {
        expect(body, 'to contain focused element matching', 'button');
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`expected <body><button>Press me</button></body> to contain focused element matching 'button'
  expected <button>Press me</button> to have focus`,
    );
  });

  it('should fail when selection matches nothing', () => {
    body.innerHTML = '<button>Press me</button>';

    expect(
      () => {
        expect(body, 'to contain focused element matching', 'div');
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`expected <body><button>Press me</button></body> to contain focused element matching 'div'`,
    );
  });
});
