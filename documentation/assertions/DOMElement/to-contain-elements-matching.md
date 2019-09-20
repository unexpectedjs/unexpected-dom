Assert that an element contains a descendant element matching the given selector.

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

expect(element, 'to contain elements matching', '[data-test-id=numbers]');
```

You get the following error when it fails:

```js
expect(element, 'to contain elements matching', '[data-test-id=emojies]');
```

```output
expected
<section>
  <h1>Numbers</h1>
  <hr>
  <ol data-test-id="numbers">
    <li>One</li>
    <li>Two</li>
    <li>Three</li>
  </ol>
</section>
to contain elements matching '[data-test-id=emojies]'
```

Using the `not` flag, you can assert that the selector can't matching any
descendant elements:

```js
expect(element, 'not to contain elements matching', '[data-test-id=emojies]');
```

You get the following error when it fails:

```js
expect(element, 'not to contain elements matching', 'li');
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
not to contain elements matching 'li'

NodeList[
  <li>One</li>, // should be removed
  <li>Two</li>, // should be removed
  <li>Three</li> // should be removed
]
```
