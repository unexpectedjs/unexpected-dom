Assert that an element contains descendant elements satisfying a given specification.

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

Expect that an element contains a subtree satisfying a HTML fragment given as
string:

```js
expect(element, 'to contain', '<h1>Assert on text content</h1>');
```

You can also assert that the element contains a given text node:

```js
expect(element, 'to contain', 'Assert on text content');
```

Or you can also assert against a DOM element:

```js
expect(element, 'to contain', createElement('<h1>Assert on text content</h1>'));
```

Finally you can also use the full power of [to
satisfy](http://unexpected.js.org/assertions/any/to-satisfy/) where you provide
the subtree you expect the subject to contain:

```js
expect(element, 'to contain', {
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
expect(element, 'to contain', '<h1 class="heading">Assert on all content</h1>');
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
to contain '<h1 class="heading">Assert on all content</h1>'

<h1
  class="title" // expected [ 'title' ] to contain 'heading'
  data-test-id="title"
>
  Assert on text content // should equal 'Assert on all content'
                         //
                         // -Assert on text content
                         // +Assert on all content
</h1>
```
