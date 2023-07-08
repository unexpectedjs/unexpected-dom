/* global expect, jsdom */

describe('"to have attributes" assertion', () => {
  let body;

  beforeEach(function () {
    const root =
      typeof jsdom !== 'undefined' ? new jsdom.JSDOM().window : window;
    body = root.document.body;
  });

  describe('argument comparison', () => {
    it('should match exact arguments', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

      expect(
        body.firstChild,
        'to only have attributes',
        'id',
        'class',
        'data-info',
        'disabled',
      );
    });

    it('should fail on exact arguments not met', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to only have attributes', 'id');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to only have attributes 'id'

        <button
          disabled // should be removed
          class="bar" // should be removed
          id="foo"
          data-info="baz" // should be removed
        >Press me</button>
      `,
      );
    });

    it('should match partial arguments', function () {
      body.innerHTML =
        '<button id="foo" class="bar" data-info="baz" style="color: #b4d455" disabled>Press me</button>';

      expect(body.firstChild, 'to have attributes', 'id', 'class', 'style');
    });

    it('should fail on partial arguments not met', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to have attributes', 'id', 'foo');
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to have attributes 'id', 'foo'

        <button
          disabled
          class="bar"
          id="foo"
          data-info="baz"
          // missing foo
        >Press me</button>
      `,
      );
    });
  });

  describe('array comparison', () => {
    it('should match exact arguments', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

      expect(body.firstChild, 'to only have attributes', [
        'id',
        'class',
        'data-info',
        'disabled',
      ]);
    });

    it('should fail on exact arguments not met', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to only have attributes', ['id']);
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to only have attributes [ 'id' ]

        <button
          disabled // should be removed
          class="bar" // should be removed
          id="foo"
          data-info="baz" // should be removed
        >Press me</button>
      `,
      );
    });

    it('should match partial arguments', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

      expect(body.firstChild, 'to have attributes', ['id', 'class']);
    });

    it('should fail on partial arguments not met', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to have attributes', ['id', 'foo']);
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to have attributes [ 'id', 'foo' ]

        <button
          disabled
          class="bar"
          id="foo"
          data-info="baz"
          // missing foo
        >Press me</button>
      `,
      );
    });

    describe('with the absence of an attribute asserted by providing undefined as the expected value', () => {
      it('should succeed', function () {
        body.innerHTML = '<button id="foo">Press me</button>';
        expect(body.firstChild, 'to have attributes', {
          quux: undefined,
        });
      });

      it('should fail with a diff', function () {
        body.innerHTML = '<button id="foo" quux="baz">Press me</button>';
        const el = body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', { quux: undefined });
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <button id="foo" quux="baz">Press me</button> to have attributes { quux: undefined }

          <button
            id="foo"
            quux="baz" // should be removed
          >Press me</button>
        `,
        );
      });
    });
  });

  describe('object comparison', () => {
    it('should match exact object', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

      expect(body.firstChild, 'to only have attributes', {
        id: 'foo',
        class: 'bar',
        'data-info': 'baz',
        disabled: true,
      });
    });

    it('should fail on exact object not satisfied', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to only have attributes', {
            id: 'foo',
          });
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to only have attributes { id: 'foo' }

        <button
          disabled // should be removed
          class="bar" // should be removed
          id="foo"
          data-info="baz" // should be removed
        >Press me</button>
      `,
      );
    });

    it('should match partial object', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';

      expect(body.firstChild, 'to have attributes', {
        id: 'foo',
        class: 'bar',
      });
    });

    it('should fail on partial object not satisfied', function () {
      body.innerHTML =
        '<button disabled class="bar" id="foo" data-info="baz">Press me</button>';
      const el = body.firstChild;

      expect(
        () => {
          expect(el, 'to have attributes', {
            id: 'foo',
            foo: 'bar',
          });
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
        expected
        <button disabled class="bar" id="foo" data-info="baz">
          Press me
        </button>
        to have attributes { id: 'foo', foo: 'bar' }

        <button
          disabled
          class="bar"
          id="foo"
          data-info="baz"
          // missing foo should equal 'bar'
        >Press me</button>
      `,
      );
    });

    describe('class attribute', () => {
      it('should match full class attributes', function () {
        body.innerHTML = '<i class="foo bar baz"></i>';

        expect(body.firstChild, 'to have attributes', {
          class: 'foo bar baz',
        });
      });

      it('should throw on unmatched class set', function () {
        body.innerHTML = '<i class="bar"></i>';
        const el = body.firstChild;

        expect(
          () => {
            expect(el, 'to have attributes', {
              class: 'foo bar baz',
            });
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <i class="bar"></i> to have attributes { class: 'foo bar baz' }

          <i
            class="bar" // expected [ 'bar' ] to contain 'foo', 'bar', 'baz'
          ></i>
        `,
        );
      });

      it('should match partial class attributes', function () {
        body.innerHTML = '<i class="foo bar baz"></i>';

        expect(body.firstChild, 'to have attributes', {
          class: 'foo bar',
        });
      });

      it('should match partial class attributes in different order', function () {
        body.innerHTML = '<i class="foo bar baz"></i>';

        expect(body.firstChild, 'to have attributes', {
          class: 'baz foo',
        });
      });

      describe('exact matches', () => {
        it('should match an exact class set', function () {
          body.innerHTML = '<i class="foo bar baz"></i>';

          expect(body.firstChild, 'to only have attributes', {
            class: 'foo bar baz',
          });
        });

        it('should match an exact class set in different order', function () {
          body.innerHTML = '<i class="foo bar baz"></i>';

          expect(body.firstChild, 'to only have attributes', {
            class: 'foo baz bar',
          });
        });

        it('should throw if class set contains more classes than comparator', function () {
          body.innerHTML = '<i class="foo bar baz"></i>';
          const el = body.firstChild;

          expect(
            () => {
              expect(el, 'to only have attributes', {
                class: 'foo baz',
              });
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i class="foo bar baz"></i> to only have attributes { class: 'foo baz' }

            <i
              class="foo bar baz" // expected [ 'bar', 'baz', 'foo' ] to equal [ 'baz', 'foo' ]
                                  //
                                  // [
                                  //   'bar', // should equal 'baz'
                                  //          //
                                  //          // -bar
                                  //          // +baz
                                  //   'baz', // should be removed
                                  //   'foo'
                                  // ]
            ></i>
          `,
          );
        });

        it('should throw if class set contains less classes than comparator', function () {
          body.innerHTML = '<i class="foo baz"></i>';
          const el = body.firstChild;

          expect(
            () => {
              expect(el, 'to only have attributes', {
                class: 'foo bar baz',
              });
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i class="foo baz"></i> to only have attributes { class: 'foo bar baz' }

            <i
              class="foo baz" // expected [ 'baz', 'foo' ] to equal [ 'bar', 'baz', 'foo' ]
                              //
                              // [
                              //   'baz', // should equal 'bar'
                              //          //
                              //          // -baz
                              //          // +bar
                              //   // missing 'baz'
                              //   'foo'
                              // ]
            ></i>
          `,
          );
        });
      });
    });

    describe('style attribute', () => {
      describe('lax comparison', () => {
        it('should do string comparisons', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to have attributes', {
            style: 'background: blue; color: red',
          });
        });

        it('should do string comparisons in any order', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to have attributes', {
            style: 'background: blue; color: red',
          });
        });

        it('should do string comparisons on partial values', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to have attributes', {
            style: 'background: blue',
          });
        });

        it('should fail when styles are missing', function () {
          body.innerHTML = '<i style="color: red"></i>';
          const node = body.firstChild;

          expect(
            () => {
              expect(node, 'to have attributes', {
                style: 'background: blue',
              });
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i style="color: red"></i> to have attributes { style: 'background: blue' }

            <i
              style="color: red" // expected { color: 'red' } to satisfy { background: 'blue' }
                                 //
                                 // {
                                 //   color: 'red'
                                 //   // missing background: 'blue'
                                 // }
            ></i>
          `,
          );
        });

        it('should do object comparisons', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to have attributes', {
            style: {
              color: 'red',
              background: 'blue',
            },
          });
        });

        it('should do partial object comparisons', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to have attributes', {
            style: {
              background: 'blue',
            },
          });
        });

        it('should fail on missing partial object comparisons', function () {
          body.innerHTML = '<i style="color: red"></i>';
          const node = body.firstChild;

          expect(
            () => {
              expect(node, 'to have attributes', {
                style: {
                  background: 'blue',
                },
              });
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i style="color: red"></i> to have attributes { style: { background: 'blue' } }

            <i
              style="color: red" // expected { color: 'red' } to satisfy { background: 'blue' }
                                 //
                                 // {
                                 //   color: 'red'
                                 //   // missing background: 'blue'
                                 // }
            ></i>
          `,
          );
        });

        it('should handle trailing semicolon', function () {
          body.innerHTML = '<div style="color: red;"></div>';

          expect(body.firstChild, 'to only have attributes', {
            style: {
              color: 'red',
            },
          });
        });

        it('should handle url values', function () {
          body.innerHTML =
            '<div style="background: url(https://www.example.com/picture.png)"></div>';

          expect(body.firstChild, 'to only have attributes', {
            style: {
              background: expect
                .it('to be', 'url(https://www.example.com/picture.png)')
                .or('to be', 'url("https://www.example.com/picture.png")'),
            },
          });
        });
      });

      describe('strict comparison', () => {
        it('should do string comparisons', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to only have attributes', {
            style: 'background: blue; color: red',
          });
        });

        it('should do string comparisons in any order', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to only have attributes', {
            style: 'background: blue; color: red',
          });
        });

        it('should fail when styles are missing', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';
          const node = body.firstChild;

          expect(
            () => {
              expect(node, 'to only have attributes', {
                style: 'background: blue',
              });
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i style="background: blue; color: red"></i>
            to only have attributes { style: 'background: blue' }

            <i
              style="background: blue; color: red" // expected { background: 'blue', color: 'red' } to exhaustively satisfy { background: 'blue' }
                                                   //
                                                   // {
                                                   //   background: 'blue',
                                                   //   color: 'red' // should be removed
                                                   // }
            ></i>
          `,
          );
        });

        it('should do object comparisons', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';

          expect(body.firstChild, 'to only have attributes', {
            style: {
              color: 'red',
              background: 'blue',
            },
          });
        });

        it('should fail on missing partial object comparisons', function () {
          body.innerHTML = '<i style="background: blue; color: red"></i>';
          const node = body.firstChild;

          expect(
            () => {
              expect(node, 'to only have attributes', {
                style: {
                  background: 'blue',
                },
              });
            },
            'to throw an error satisfying to equal snapshot',
            expect.unindent`
            expected <i style="background: blue; color: red"></i>
            to only have attributes { style: { background: 'blue' } }

            <i
              style="background: blue; color: red" // expected { background: 'blue', color: 'red' } to exhaustively satisfy { background: 'blue' }
                                                   //
                                                   // {
                                                   //   background: 'blue',
                                                   //   color: 'red' // should be removed
                                                   // }
            ></i>
          `,
          );
        });
      });
    });
  });

  describe('with the "not" flag', () => {
    describe('when given one of more strings', () => {
      it('should pass if the given element does not have any the provided attribute names', () => {
        body.innerHTML = '<div style="background: blue; color: red" />';
        const node = body.firstChild;

        expect(node, 'not to have attributes', 'data-test-id', 'class');
      });

      it('should fail if the given element has one of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', 'data-test-id', 'class');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red"></div>
          not to have attributes 'data-test-id', 'class'

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
          ></div>
        `,
        );
      });

      it('should fail if the given element has multiple of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red" data-test-id="my-div"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', 'data-test-id', 'class');
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red" data-test-id="my-div"></div>
          not to have attributes 'data-test-id', 'class'

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
            data-test-id="my-div" // should be removed
          ></div>
        `,
        );
      });
    });

    describe('when given an array', () => {
      it('should pass if the given element does not have any of the provided attribute names', () => {
        body.innerHTML = '<div style="background: blue; color: red" />';
        const node = body.firstChild;

        expect(node, 'not to have attributes', ['data-test-id', 'class']);
      });

      it('should fail if the given element has one of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', ['data-test-id', 'class']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red"></div>
          not to have attributes [ 'data-test-id', 'class' ]

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
          ></div>
        `,
        );
      });

      it('should fail if the given element has multiple of the provided attributes', () => {
        body.innerHTML =
          '<div class="my-class" style="background: blue; color: red" data-test-id="my-div"/>';
        const node = body.firstChild;

        expect(
          () => {
            expect(node, 'not to have attributes', ['data-test-id', 'class']);
          },
          'to throw an error satisfying to equal snapshot',
          expect.unindent`
          expected <div class="my-class" style="background: blue; color: red" data-test-id="my-div"></div>
          not to have attributes [ 'data-test-id', 'class' ]

          <div
            class="my-class" // should be removed
            style="background: blue; color: red"
            data-test-id="my-div" // should be removed
          ></div>
        `,
        );
      });
    });
  });
});
