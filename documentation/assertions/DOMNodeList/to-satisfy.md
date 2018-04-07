Assert that a DOM node list satisfies a given specification.

See [to satisfy](../../DOMElement/to-satisfy/) for more details.

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

expect(element, 'queried for', '[data-test-id=numbers] > li', 'to satisfy', [
  '<li>One</li>',
  { children: [/Two/] },
  expect.it('to have text', 'Three')
]);

expect(
  element,
  'queried for',
  '[data-test-id=numbers] > *',
  'to have items satisfying',
  {
    name: 'li'
  }
);
```

In case of a failing expectation you get the following output:

```js
expect(element, 'queried for', '[data-test-id=numbers] > li', 'to satisfy', [
  '<li>Three</li>',
  '<li>Two</li>',
  '<li>One</li>'
]);
```

```output
expected
<section><h1>Numbers</h1><hr><ol data-test-id="numbers">
  <li class="number">...</li>
  <li class="number">...</li>
  <li class="number">...</li>
</ol></section>
queried for [data-test-id=numbers] > li to satisfy [ '<li>Three</li>', '<li>Two</li>', '<li>One</li>' ]
  expected
  NodeList[
    <li class="number">One</li>,
    <li class="number">Two</li>,
    <li class="number">Three</li>
  ]
  to satisfy [ '<li>Three</li>', '<li>Two</li>', '<li>One</li>' ]

  NodeList[
  ┌───▷
  │ ┌─▷
  │ │   <li class="number">One</li>,
  │ └── <li class="number">Two</li>, // should be moved
  └──── <li class="number">Three</li> // should be moved
  ]
```

Using the `exhaustively` flag you can ensure that only attributes, classes and
styles specified in the expected output are present:

```js
expect(
  element,
  'queried for',
  '[data-test-id=numbers] > li',
  'to exhaustively satisfy',
  [
    '<li class="number">One</li>',
    '<li class="number">Two</li>',
    '<li>Three</li>'
  ]
);
```

```output
expected
<section><h1>Numbers</h1><hr><ol data-test-id="numbers">
  <li class="number">...</li>
  <li class="number">...</li>
  <li class="number">...</li>
</ol></section>
queried for
[data-test-id=numbers] > li to exhaustively satisfy [
  '<li class="number">One</li>',
  '<li class="number">Two</li>',
  '<li>Three</li>'
]
  expected
  NodeList[
    <li class="number">One</li>,
    <li class="number">Two</li>,
    <li class="number">Three</li>
  ]
  to exhaustively satisfy
  [
    '<li class="number">One</li>',
    '<li class="number">Two</li>',
    '<li>Three</li>'
  ]

  NodeList[
    <li class="number">One</li>,
    <li class="number">Two</li>,
    <li
      class="number" // should be removed
    >Three</li>
  ]
```
