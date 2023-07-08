/* global expect, jsdom */

describe('"to have children" assertion', () => {
  let body;

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

  describe('with no children flag', () => {
    it('should match element with no children', function () {
      body.innerHTML = '<div></div>';
      const el = body.firstChild;

      expect(el, 'to have no children');
    });

    it('should fail on element with HTMLElement children', function () {
      body.innerHTML = '<div><p></p></div>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to have no children');
        },
        'to throw an error satisfying to equal snapshot',
        'expected <div><p></p></div> to have no children'
      );
    });

    it('should fail on element with HTMLComment children', function () {
      body.innerHTML = '<div><!-- Comment --></div>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to have no children');
        },
        'to throw an error satisfying to equal snapshot',
        'expected <div><!-- Comment --></div> to have no children'
      );
    });

    it('should fail on element with TextNode children', function () {
      body.innerHTML = '<div>I am a text</div>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to have no children');
        },
        'to throw an error satisfying to equal snapshot',
        'expected <div>I am a text</div> to have no children'
      );
    });
  });
});
