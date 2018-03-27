Assert that an element has the given text.

```js
var element = createElement(`
  <section>
    <h1>Assert on text content</h1>
    <p>
      Learn about howto assert on the text content of a DOM element.
    </p>
    <p data-text-id='learn'>
      Learn more <a href='https://example.com/learn'>here</a>.
    </p>
  </section>
`);


expect(
  element,
  'queried for first', 'h1',
  'to have text',
  'Assert on text content'
);

expect(
  element,
  'queried for first', 'p',
  'to have text',
  'Learn about howto assert on the text content of a DOM element.'
);

expect(
  element,
  'queried for first', '[data-text-id=learn]',
  'to have text',
  'Learn more here.'
);
```

In case of a failing expectation you get the following output:

```js
expect(
  element,
  'queried for first', 'p',
  'to have text',
  'Read about howto assert on the text content of a DOM element.'
);
```

```output
expected
<section>
  <h1>Assert on text content</h1>
  <p>
    Learn about howto assert on the text content of a DOM element.
  </p>
  <p data-text-id="learn">
    Learn more
    <a href="https://example.com/learn">...</a>
    .
  </p>
</section>
queried for first p to have text 'Read about howto assert on the text content of a DOM element.'
  expected
  <p>
    Learn about howto assert on the text content of a DOM element.
  </p>
  to have text 'Read about howto assert on the text content of a DOM element.'

  -Learn about howto assert on the text content of a DOM element.
  +Read about howto assert on the text content of a DOM element.
```
