Assert that an element matches the given selector.

```js
var element = createElement(`
  <button data-test-id="publish" class="primary" disabled>
    Publish
  </button>
`);

expect(element, 'to match', 'button:disabled');
expect(element, 'to match', '[data-test-id=publish]');
expect(element, 'to match', '.primary');
```

In case of a failing expectation you get the following output:

```js
expect(element, 'to match', '[data-test-id=approve]');
```

```output
expected
<button class="primary" data-test-id="publish" disabled>
  Publish
</button>
to match '[data-test-id=approve]'
```

You can also assert that an element does not match a given selector:

```js
expect(element, 'not to match', '.default');
```
