Queries the subject element with the given CSS selector and forwards it to another assertion.

If the selector doesn't match anything is fails.

```js
var element = createElement(`
  <section>
    <h1>Numbers</h1>
    <hr>
    <ol data-test-id="numbers">
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </ol>
  </section>
`);

expect(element, 'queried for', '[data-test-id=numbers] > li', 'to satisfy', [
  '<li>One</li>',
  '<li>Two</li>',
  '<li>Three</li>'
]);

expect(element, 'queried for first', 'hr', 'to have no children');
```

If you use the `first` flag, the first maching element will be forwarded to the next assertion:

```js
expect(element, 'queried for first', '[data-test-id=numbers]', 'to satisfy', {
  children: expect.it('to have length', 3)
});
```

If no matching element can be found you get the following error:

```js
expect(element, 'queried for first', '[data-test-id=emojies]', 'to satisfy', {
  children: expect.it('to have length', 666)
});
```

```output
expected
<section><h1>Numbers</h1><hr><ol data-test-id="numbers">
  <li>One</li>
  <li>Two</li>
  <li>Three</li>
</ol></section>
queried for first [data-test-id=emojies] to satisfy { children: expect.it('to have length', 666) }
  The selector [data-test-id=emojies] yielded no results
```

In case the next assertion fails you will get an error looking like this:

```js
expect(
  element,
  'queried for first',
  '[data-test-id=numbers]',
  'to have no children'
);
```

```output
expected
<section><h1>Numbers</h1><hr><ol data-test-id="numbers">
  <li>...</li>
  <li>...</li>
  <li>...</li>
</ol></section>
queried for first [data-test-id=numbers] to have no children
  expected
  <ol data-test-id="numbers">
    <li>One</li>
    <li>Two</li>
    <li>Three</li>
  </ol>
  to have no children
```
