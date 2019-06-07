Assert that an element does not have any of the given classes.

```js
var element = createElement(`
  <button
    class="something"
    data-test-id="pay"
  >
    Click me!
  </button>
`);

expect(element, 'not to have class', 'other');
expect(element, 'not to have class', ['other', 'another']);
```

An alias is provided when using multiple classes for better readability:

```js
expect(element, 'not to have classes', ['other', 'another']);
```

In case of a failing expectation you get the following output:

```js
expect(element, 'not to have class', 'something');
```

```output
expected <button class="something" data-test-id="pay">Click me!</button>
not to have class 'something'

<button
  class="something" // expected [ 'something' ] not to contain 'something'
                    //
                    // [
                    //   'something' // should be removed
                    // ]
  data-test-id="pay"
>Click me!</button>
```
