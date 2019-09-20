Assert that an element contains a descendant element with element with the given `data-test-id`
attribute.

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

expect(element, 'to contain test id', 'numbers');
```

You get the following error when it fails:

```js
expect(element, 'to contain test id', 'emojies');
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
to contain test id 'emojies'
  expected DOMElement to contain elements matching '[data-test-id="emojies"]'
```

Using the `not` flag, you can assert that the test id shouldn't be found on any
descendant elements:

```js
expect(element, 'not to contain test id', 'emojies');
```

You get the following error when it fails:

```js
expect(element, 'not to contain test id', 'numbers');
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
not to contain test id 'numbers'
  expected DOMElement not to contain elements matching '[data-test-id="numbers"]'

  NodeList[
    <ol data-test-id="numbers">
      <li>...</li>
      <li>...</li>
      <li>...</li>
    </ol> // should be removed
  ]
```
