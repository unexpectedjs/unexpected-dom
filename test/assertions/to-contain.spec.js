/* global expect, jsdom, DOMParser */

const parseHtmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'text/html')
    : (str) => new jsdom.JSDOM(str).window.document;

const parseXmlDocument =
  typeof DOMParser !== 'undefined'
    ? (str) => new DOMParser().parseFromString(str, 'application/xml')
    : (str) =>
        new jsdom.JSDOM(str, { contentType: 'text/xml' }).window.document;

function parseHtml(str) {
  return parseHtmlDocument(`<!DOCTYPE html><html><body>${str}</body></html>`)
    .body.firstChild;
}

function parseHtmlFragment(str) {
  const htmlDocument = parseHtmlDocument(
    `<html><head></head><body>${str}</body></html>`,
  );
  const body = htmlDocument.body;
  const documentFragment = htmlDocument.createDocumentFragment();
  if (body) {
    for (let i = 0; i < body.childNodes.length; i += 1) {
      documentFragment.appendChild(body.childNodes[i].cloneNode(true));
    }
  }
  return documentFragment;
}

describe('"to contain" assertion', () => {
  describe('on a DOMDocument', () => {
    describe('when given a DOMElement', () => {
      it('succeeds if the given structure is present', () => {
        expect(
          parseHtmlDocument(
            '<!DOCTYPE html><html><body><div><i>Hello</i> <span class="name something-else">Jane Doe</span></div></body></html>',
          ),
          'to contain',
          parseHtml('<span class="name">Jane Doe</span>'),
        );
      });
    });
  });

  describe('on a DOMDocumentFragment', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseHtmlFragment(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        '<span class="name">Jane Doe</span>',
      );
    });
  });

  describe('on a DOMElement', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        '<span class="name">Jane Doe</span>',
      );
    });
  });

  describe('on a DOMNodeList', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseHtmlFragment(
          '<div>Nothing here</div><div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        '<span class="name">Jane Doe</span>',
      );
    });
  });

  describe('on an XMLDocument', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseXmlDocument(
          '<?xml version="1.0"?><qux><fooBar yes="sir">foo</fooBar> bax <Quux>baax</Quux></qux>',
        ),
        'to contain',
        '<fooBar yes="sir">foo</fooBar>',
      );
    });
  });

  describe('when given a DOMElement', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        parseHtml('<span class="name">Jane Doe</span>'),
      );
    });
  });

  describe('when given a spec', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        {
          name: 'span',
          attributes: { class: 'name' },
          textContent: expect.it('to match', /^Jane/).and('to have length', 8),
        },
      );
    });

    it('supports searching for class names', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        {
          attributes: { class: 'something-else name' },
        },
      );
    });

    it('supports searching for inline-styles by an object', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
        ),
        'to contain',
        {
          attributes: { style: { 'background-color': 'red' } },
        },
      );
    });

    it('supports searching for inline-styles by a string', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
        ),
        'to contain',
        {
          attributes: { style: 'background-color: red' },
        },
      );
    });

    it('supports using regexps on the tag name', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
        ),
        'to contain',
        {
          name: /^(i|span)$/,
          textContent: 'Hello',
        },
      );
    });

    it('supports using expect.it on the tag name', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
        ),
        'to contain',
        {
          name: expect.it('to have length', 1),
          textContent: 'Hello',
        },
      );
    });

    it('supports using regexps on the class name', () => {
      expect(
        parseHtml(
          '<div><i class="greeting">Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
        ),
        'to contain',
        {
          attributes: {
            class: /^name something/,
          },
        },
      );
    });

    it('supports using expect.it on the class name', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else" style="background-color: red; color: green">Jane Doe</span></div>',
        ),
        'to contain',
        {
          attributes: {
            class: expect.it('to end with', 'else'),
          },
          textContent: 'Jane Doe',
        },
      );
    });

    it('supports using declaring that the class should be undefined', () => {
      expect(
        parseHtml('<div><i class="wat">Hello!</i> <i>Hello</i></div>'),
        'to contain',
        {
          attributes: {
            class: undefined,
          },
          textContent: 'Hello',
        },
      );
    });

    it('supports searching for boolean attributes', () => {
      expect(
        parseHtml(
          '<div><i class="greeting">Hello</i> <span class="name something-else and-this">Jane Doe</span> <input type="checkbox" checked="checked"></div>',
        ),
        'to contain',
        {
          name: 'input',
          attributes: { checked: true },
        },
      );
    });

    it('supports searching for false boolean attributes', () => {
      expect(parseHtml('<div><input type="checkbox"></div>'), 'to contain', {
        name: 'input',
        attributes: { checked: undefined },
      });
    });

    it('supports searching for a child element', () => {
      expect(
        parseHtml(
          '<div><span class="greeting"><i>Hello</i><!-- comment --></span> Jane Doe</div>',
        ),
        'to contain',
        {
          name: 'span',
          children: [parseHtml('<i>Hello</i>'), parseHtml('<!-- comment -->')],
        },
      );
    });

    it('supports the onlyAttributes flag', () => {
      expect(
        parseHtml('<div><span class="greeting">Hello</span> Jane Doe</div>'),
        'to contain',
        {
          name: 'span',
          attributes: {
            class: 'greeting',
          },
          onlyAttributes: true,
        },
      );
    });
  });

  describe('when given a string', () => {
    it('succeeds if the given structure is present', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
        ),
        'to contain',
        '<span class="name">Jane Doe</span>',
      );
    });

    it('fails when given more than on node', () => {
      expect(
        () => {
          expect(
            parseHtml(
              '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
            ),
            'to contain',
            '<span class="name">Jane Doe</span>!',
          );
        },
        'to throw an error satisfying to equal snapshot',
        'HTMLElement to contain string: Only a single node is supported',
      );
    });
  });

  describe('when used with expect.it', () => {
    it('fails with an unsupported message at the top-level', () => {
      expect(
        () => {
          expect(
            parseHtml('<div></div>'),
            'to contain',
            expect.it('not to have attributes', 'class'),
          );
        },
        'to throw',
        'Unsupported value for "to contain" assertion: expect.it',
      );
    });
  });

  it('supports only stating a subset of the classes', () => {
    expect(
      parseHtml(
        '<div><i class="greeting">Hello</i> <span class="name something-else and-this">Jane Doe</span></div>',
      ),
      'to contain',
      '<span class="name and-this">Jane Doe</span>',
    );
  });

  it('supports searching for boolean attributes', () => {
    expect(
      parseHtml(
        '<div><i class="greeting">Hello</i> <span class="name something-else and-this">Jane Doe</span> <input type="checkbox" checked="checked"></div>',
      ),
      'to contain',
      '<input type="checkbox" checked="checked">',
    );
  });

  it('supports searching for style values', () => {
    expect(
      parseHtml(
        '<div><i style="color: red">Hello</i> <span style="color: blue; background: #bad5aa">Jane Doe</span><em style="background: orange">!</em></div>',
      ),
      'to contain',
      '<span style="color: blue">Jane Doe</span>',
    );
  });

  it('takes ignore comments into account when searching children', () => {
    expect(
      parseHtml(
        '<div><span class="greeting"><span>Hello</span><span class="name">Jane Doe</span></span></div>',
      ),
      'to contain',
      '<span><span>Hello</span><!--ignore--></span>',
    );
  });

  it('fails searching for a plain string', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><span class="greeting"><span>Hello</span><span class="name">Jane Doe</span></span></div>',
          ),
          'to contain',
          'Jane Doe',
        );
      },
      'to throw an error satisfying to equal snapshot',
      'HTMLElement to contain string: please provide a HTML structure as a string',
    );
  });

  it('fails when matching against an element with no children', () => {
    expect(
      () => {
        expect(parseHtml('<div></div>'), 'to contain', '<span>Jane Doe</span>');
      },
      'to throw an error satisfying to equal snapshot',
      'expected <div></div> to contain <span>Jane Doe</span>',
    );
  });

  it('should not match directly on the subject', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<span class="greeting"><span>Hello</span><span class="name">Jane Doe</span></span>',
          ),
          'to contain',
          '<span><span>Hello</span><!--ignore--></span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected
      <span class="greeting">
        <span>Hello</span>
        <span class="name">Jane Doe</span>
      </span>
      to contain <span><span>Hello</span><!--ignore--></span>

      <span>
        // missing <span>Hello</span>
        Hello
      </span>
    `,
    );
  });

  it('fails without a diff if no good candidates can be found in the given structure', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><div><div><div><div><div></div></div></div></div></div></div>',
          ),
          'to contain',
          '<span class="name">John Doe</span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <div><div><div><div><div><div></div></div></div></div></div></div>
      to contain <span class="name">John Doe</span>
    `,
    );
  });

  it('fails with a diff if the given structure is not present', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><i>Hello</i> <span class="name something-else">Jane Doe</span></div>',
          ),
          'to contain',
          '<span class="name">John Doe</span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
        expected
        <div>
          <i>Hello</i>

          <span class="name something-else">Jane Doe</span>
        </div>
        to contain <span class="name">John Doe</span>

        <span class="name something-else">
          Jane Doe // should equal John Doe
                   //
                   // -Jane Doe
                   // +John Doe
        </span>
      `,
    );
  });

  it('allows tag names to be different while finding the best match', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><i>Hello</i> <span class="name something-else">Jane Doe</span> and <div>John Doe</div></div>',
          ),
          'to contain',
          '<div class="name">Jane Doe</div>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
        expected
        <div>
          <i>Hello</i>

          <span class="name something-else">Jane Doe</span>
          and
          <div>John Doe</div>
        </div>
        to contain <div class="name">Jane Doe</div>

        <span // should equal 'div'
          class="name something-else"
        >Jane Doe</span>
      `,
    );
  });

  it('matches on sub-trees when searching for the best match', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><i>Hello</i> <span class="name something-else"><em>Jane Doe</em></span> and <div>John Doe</div></div>',
          ),
          'to contain',
          '<span class="name"><i>Jane Doe</i></span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
        expected
        <div>
          <i>Hello</i>

          <span class="name something-else"><em>...</em></span>
          and
          <div>John Doe</div>
        </div>
        to contain <span class="name"><i>Jane Doe</i></span>

        <span class="name something-else">
          <em // should equal 'i'
          >Jane Doe</em>
        </span>
      `,
    );
  });

  it('matches more strongly on ids when showing the best match', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><i>Hello</i> <span class="name something-else" data-test-id="name">Jane Doe</span> and <span class="name">John Doe</span></div>',
          ),
          'to contain',
          '<span data-test-id="name">John Doe</span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
        expected
        <div>
          <i>Hello</i>

          <span class="name something-else" data-test-id="name">
            Jane Doe
          </span>
          and
          <span class="name">John Doe</span>
        </div>
        to contain <span data-test-id="name">John Doe</span>

        <span class="name something-else" data-test-id="name">
          Jane Doe // should equal John Doe
                   //
                   // -Jane Doe
                   // +John Doe
        </span>
      `,
    );
  });

  it('fails if the children is expected but the target is empty', () => {
    expect(
      () => {
        expect(
          parseHtml('<div><span></span></div>'),
          'to contain',
          '<span><i>Hello</i></span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <div><span></span></div> to contain <span><i>Hello</i></span>

      <span>
        // missing <i>Hello</i>
      </span>
    `,
    );
  });

  it('fails if the an ignored child is expected but the target is empty', () => {
    expect(
      () => {
        expect(
          parseHtml('<div><span></span></div>'),
          'to contain',
          '<span><!-- ignore --></span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <div><span></span></div> to contain <span><!-- ignore --></span>

      <span>
        // missing <!-- ignore -->
      </span>
    `,
    );
  });

  it('fails if more children is expected than what is available in the target', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><span><strong>Hello</strong><em>world</em></span></div>',
          ),
          'to contain',
          '<span><strong>Hello</strong><!-- ignore -->!</span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <div><span><strong>...</strong><em>...</em></span></div>
      to contain <span><strong>Hello</strong><!-- ignore -->!</span>

      <span>
        <strong>Hello</strong>
        <em>world</em>
        // missing !
      </span>
    `,
    );
  });

  it('fails if less children is expected than what is available in the target', () => {
    expect(
      () => {
        expect(
          parseHtml(
            '<div><span><strong>Hello</strong><em>world</em>!</span></div>',
          ),
          'to contain',
          '<span><strong>Hello</strong><em>world</em></span>',
        );
      },
      'to throw an error satisfying to equal snapshot',
      expect.unindent`
      expected <div><span><strong>...</strong><em>...</em>!</span></div>
      to contain <span><strong>Hello</strong><em>world</em></span>

      <span>
        <strong>Hello</strong>
        <em>world</em>
        ! // should be removed
      </span>
    `,
    );
  });

  describe('with the "not" flag', () => {
    it('succeeds if the given structure is not present', () => {
      expect(
        parseHtml(
          '<div><i>Hello</i> <span class="name something-else" data-test-id="name">Jane Doe</span> and <span class="name">John Doe</span></div>',
        ),
        'not to contain',
        '<span data-test-id="name">John Doe</span>',
      );
    });

    it("succeeds if the given structure doesn't match any descendant elements at all", () => {
      expect(
        parseHtml(
          '<div><div><div><div><div><div></div></div></div></div></div></div>',
        ),
        'not to contain',
        '<span data-test-id="name">John Doe</span>',
      );
    });

    it('succeeds if the element has no children', () => {
      expect(
        parseHtml('<div></div>'),
        'not to contain',
        '<span>Jane Doe</span>',
      );
    });

    it('shows a diff if the given structure is present', () => {
      expect(
        () => {
          expect(
            parseHtml(
              '<div><i>Hello</i> <span class="name something-else" data-test-id="name">Jane Doe</span> and <span class="name">John Doe</span></div>',
            ),
            'not to contain',
            '<span data-test-id="name">Jane Doe</span>',
          );
        },
        'to throw an error satisfying to equal snapshot',
        expect.unindent`
          expected
          <div>
            <i>Hello</i>

            <span class="name something-else" data-test-id="name">
              Jane Doe
            </span>
            and
            <span class="name">John Doe</span>
          </div>
          not to contain <span data-test-id="name">Jane Doe</span>

          Found:

          <span class="name something-else" data-test-id="name">
            Jane Doe
          </span>
        `,
      );
    });
  });
});
