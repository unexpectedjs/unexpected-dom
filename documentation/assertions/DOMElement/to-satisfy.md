Assert that an element satisfy the given specification.

```js
var element = createElement(`
  <section>
    <h1 class='title' data-test-id='title'>Assert on text content</h1>
    <p>
      Learn about howto assert on the text content of a DOM element.
    </p>
    <p data-test-id='learn'>
      Learn more <a href='https://example.com/learn'>here</a>.
    </p>
  </section>
`);
```

Expect that an element satisfies a HTML fragment given as string:

```js
expect(
  element,
  'queried for first',
  '[data-test-id=title]',
  'to satisfy',
  '<h1>Assert on text content</h1>'
);
```

You can also assert against a DOM element:

```js
expect(
  element,
  'queried for first',
  '[data-test-id=title]',
  'to satisfy',
  createElement('<h1>Assert on text content</h1>')
);
```

Finally you can also use the full power of [to
satisfy](http://unexpected.js.org/assertions/any/to-satisfy/) where you provide
the subtree you want to match against:

```js
expect(element, 'queried for first', '[data-test-id=learn]', 'to satisfy', {
  children: [
    /^Learn/,
    {
      name: 'a',
      attributes: {
        href: 'https://example.com/learn'
      },
      children: ['here']
    },
    '.'
  ]
});
```

When the assertion fails you get a nice descriptive error:

```js
expect(
  element,
  'queried for first',
  '[data-test-id=title]',
  'to satisfy',
  '<h1>Assert on all content</h1>'
);
```

```output
expected
<section>
  <h1 class="title" data-test-id="title">
    Assert on text content
  </h1>
  <p>
    Learn about howto assert on the text content of a DOM element.
  </p>
  <p data-test-id="learn">
    Learn more
    <a href="https://example.com/learn">...</a>
    .
  </p>
</section>
queried for first [data-test-id=title] to satisfy '<h1>Assert on all content</h1>'
  expected
  <h1 class="title" data-test-id="title">
    Assert on text content
  </h1>
  to satisfy <h1>Assert on all content</h1>

  <h1 class="title" data-test-id="title">
    Assert on text content // should equal 'Assert on all content'
                           //
                           // -Assert on text content
                           // +Assert on all content
  </h1>
```

Using the `exhaustively` flag you can ensure that only attributes, class and
styles specified in the expected output is use:

```js
var title = element.querySelector('[data-test-id=title]');

expect(title, 'to exhaustively satisfy', '<h1>Assert on text content</h1>');
```

This will fail because the `h1` tag has more attributes than we expected:

```output
expected
<h1 class="title" data-test-id="title">
  Assert on text content
</h1>
to exhaustively satisfy <h1>Assert on text content</h1>

<h1
  class="title" // should be removed
  data-test-id="title" // should be removed
>Assert on text content</h1>
```
