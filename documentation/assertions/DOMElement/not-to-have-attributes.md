Assert that an element does not have any of the given attributes.

```js
var element = createElement(`
  <button
    class="primary"
    data-test-id="pay"
  >
    Click me!
  </button>
`);

expect(element, 'not to have attribute', 'disabled');
expect(element, 'not to have attributes', 'id', 'disabled');
expect(element, 'not to have attributes', ['id', 'disabled']);
```

In case of a failing expectation you get the following output:

```js
expect(element, 'not to have attribute', 'class');
```

```output
expected <button class="primary" data-test-id="pay">Click me!</button>
not to have attribute 'class'

<button
  class="primary" // should be removed
  data-test-id="pay"
>Click me!</button>
```
