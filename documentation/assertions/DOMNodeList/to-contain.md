Assert that a DOM node list contains elements satisfying a given specification.

See [to contain](../../DOMElement/to-contain/) for more details.

```js
var element = createElement(`
  <section>
    <h1>Numbers</h1>
    <hr>
    <ol data-test-id="numbers">
      <li class="number">One</li>
      <li class="number">Two</li>
      <li class="number">Three</li>
    </ol>
  </section>
`);

expect(element, 'queried for', 'li', 'to contain', '<li>One</li>');

expect(element, 'to contain', { textContent: 'Three' });

expect(element, 'to contain', { name: 'li', textContent: /One|Two|Tree/ });
```

In case of a failing expectation you get the following output:

```js
expect(
  element,
  'queried for',
  'li',
  'to contain',
  '<li class="count">Three</li>'
);
```

```output
expected
<section>
  <h1>Numbers</h1>
  <hr>
  <ol data-test-id="numbers">
    <li class="number">...</li>
    <li class="number">...</li>
    <li class="number">...</li>
  </ol>
</section>
queried for li to contain '<li class="count">Three</li>'
  expected
  NodeList[
    <li class="number">One</li>,
    <li class="number">Two</li>,
    <li class="number">Three</li>
  ]
  to contain <li class="count">Three</li>

  <li
    class="number" // expected [ 'number' ] to contain 'count'
  >Three</li>
```

You can also assert that the element has no descendant elements satisfying the
given specification:

```js
expect(
  element,
  'queried for',
  'li',
  'not to contain',
  '<li class="count">Three</li>'
);
```
