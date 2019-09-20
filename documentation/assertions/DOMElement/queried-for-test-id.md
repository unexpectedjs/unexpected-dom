Queries the subject element for the first descendant element with the given `data-test-id`
attribute and forwards it to another assertion.

If the data-test-id is not found it fails.

```js
var element = createElement(`
  <section>
    <h1>Numbers</h1>
    <hr>
    <ol data-test-id="numbers">
      <li >One</li>
      <li>Two</li>
      <li>Three</li>
    </ol>
  </section>
`);

expect(element, 'queried for test id', 'numbers', 'to satisfy', {
  children: expect.it('to have length', 3)
});
```

If no matching element can be found you get the following error:

```js
expect(element, 'queried for test id', 'emojies', 'to satisfy', {
  children: expect.it('to have length', 666)
});
```

```output
expected
<section>
  <h1>Numbers</h1>
  <hr>
  <ol data-test-id="numbers">
    <li>...</li>
    <li>...</li>
    <li>...</li>
  </ol>
</section>
queried for test id 'emojies' to satisfy { children: expect.it('to have length', 666) }
  expected DOMElement queried for first [data-test-id="emojies"]
    The selector [data-test-id="emojies"] yielded no results
```

In case the next assertion fails you will get an error looking like this:

```js
expect(
  element,
  'queried for test id',
  'numbers',
  'to have no children'
);
```

```output
expected
<section>
  <h1>Numbers</h1>
  <hr>
  <ol data-test-id="numbers">
    <li>...</li>
    <li>...</li>
    <li>...</li>
  </ol>
</section>
queried for test id 'numbers' to have no children
  expected
  <ol data-test-id="numbers">
    <li>One</li>
    <li>Two</li>
    <li>Three</li>
  </ol>
  to have no children
```
