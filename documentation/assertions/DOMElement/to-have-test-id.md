Assert that an element have the given `data-test-id` attribute.

```js
var element = createElement(`
  <button data-test-id="publish" class="primary" disabled>
    Publish
  </button>
`);

expect(element, 'to have test id', 'publish');
```

In case of a failing expectation you get the following output:

```js
expect(element, 'to have test id', 'approve');
```

```output
expected
<button data-test-id="publish" class="primary" disabled>
  Publish
</button>
to have test id 'approve'
  expected DOMElement to match '[data-test-id="approve"]'
```

You can also assert that an element does not have a test id:

```js
expect(element, 'not to have test id', 'approve');
```

In case of a failing expectation you get the following output:

```js
expect(element, 'not to have test id', 'publish');
```

```output
expected
<button data-test-id="publish" class="primary" disabled>
  Publish
</button>
not to have test id 'publish'
  expected DOMElement not to match '[data-test-id="publish"]'
```
