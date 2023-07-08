/* global expect, jsdom */

describe('"to have class" assertion', () => {
  let body;

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

  it('should handle a non-existing class', () => {
    body.innerHTML = '<button>Press me</button>';

    expect(
      () => {
        expect(body.firstChild, 'to have class', 'foo');
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <button>Press me</button> to have class 'foo'

      <button
        // missing class should satisfy 'foo'
      >Press me</button>
    `,
    );
  });

  describe('with a single class passed as a string', () => {
    it('should succeed', () => {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      expect(body.firstChild, 'to have class', 'bar');
    });

    it('should fail with a diff', () => {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      expect(
        () => {
          expect(body.firstChild, 'to have class', 'quux');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to have class 'quux'

        <button
          disabled
          class="bar" // expected [ 'bar' ] to contain 'quux'
          id="foo"
          data-info="baz"
        >Press me</button>
      `,
      );
    });
  });

  describe('with multiple classes passed as an array', () => {
    it('should succeed', () => {
      body.innerHTML =
        '<button id="foo" class="bar foo" data-info="baz" disabled>Press me</button>';
      expect(body.firstChild, 'to have classes', ['foo', 'bar']);
    });

    it('should fail with a diff', () => {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      expect(
        () => {
          expect(body.firstChild, 'to have classes', ['quux', 'bar']);
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to have classes [ 'quux', 'bar' ]

        <button
          disabled
          class="bar" // expected [ 'bar' ] to contain 'quux', 'bar'
          id="foo"
          data-info="baz"
        >Press me</button>
      `,
      );
    });
  });

  describe('with the "not" flag', () => {
    describe('with a single class passed as a string', () => {
      it('should succeed', () => {
        body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        expect(body.firstChild, 'not to have class', 'foo');
      });

      it('should fail with a diff', () => {
        body.innerHTML =
          '<button disabled class="bar quux" id="foo" data-info="baz">Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'not to have class', 'quux');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar quux" id="foo" data-info="baz">
            Press me
          </button>
          not to have class 'quux'

          <button
            disabled
            class="bar quux" // expected [ 'bar', 'quux' ] not to contain 'quux'
                             //
                             // [
                             //   'bar',
                             //   'quux' // should be removed
                             // ]
            id="foo"
            data-info="baz"
          >Press me</button>
        `,
        );
      });
    });
  });

  describe('with the "only" flag', () => {
    describe('with a single class passed as a string', () => {
      it('should succeed', () => {
        body.innerHTML =
          '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
        expect(body.firstChild, 'to only have class', 'bar');
      });

      it('should fail with a diff', () => {
        body.innerHTML =
          '<button disabled class="bar quux" id="foo" data-info="baz">Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'to only have class', 'quux');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar quux" id="foo" data-info="baz">
            Press me
          </button>
          to only have class 'quux'

          <button
            disabled
            class="bar quux" // expected [ 'bar', 'quux' ] to equal [ 'quux' ]
                             //
                             // [
                             //   'bar', // should be removed
                             //   'quux'
                             // ]
            id="foo"
            data-info="baz"
          >Press me</button>
        `,
        );
      });
    });

    describe('with multiple classes passed as an array', () => {
      it('should succeed', () => {
        body.innerHTML =
          '<button id="foo" class="bar foo" data-info="baz" disabled>Press me</button>';
        expect(body.firstChild, 'to only have classes', ['foo', 'bar']);
      });

      it('should fail with a diff', () => {
        body.innerHTML =
          '<button disabled class="bar quux foo" id="foo" data-info="baz">Press me</button>';
        expect(
          () => {
            expect(body.firstChild, 'to only have classes', ['quux', 'bar']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected
          <button disabled class="bar quux foo" id="foo" data-info="baz">
            Press me
          </button>
          to only have classes [ 'bar', 'quux' ]

          <button
            disabled
            class="bar quux foo" // expected [ 'bar', 'foo', 'quux' ] to equal [ 'bar', 'quux' ]
                                 //
                                 // [
                                 //   'bar',
                                 //   'foo', // should be removed
                                 //   'quux'
                                 // ]
            id="foo"
            data-info="baz"
          >Press me</button>
        `,
        );
      });
    });
  });
});
