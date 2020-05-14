Assert that an element is the currently focused element on the page.

```js
var element = createElement(`
  <button>
    Focused
  </button>
`);

element.focus();

expect(element, 'to have focus');
```

In case of a failing expectation you get the following output:

```js
var element = createElement(`
  <button>
    Not Focused
  </button>
`);

element.blur();

expect(element, 'to have focus');
```

```output
expected <button>Not Focused</button> to have focus
```

## Combining with other assertions

You can combine this assertion with other assertions:

```js
var element = createElement(`
  <form>
  <label>
    <span>Name</span>
    <input type="text">
  </label>
  <button>Focused</button>
  </form>
`);

element.querySelector('button').focus();

// Using a forwarding assertion
expect(element, 'queried for first', 'button', 'to have focus');

// Using a nested assertion call
expect(element, 'to satisfy', {
  children: [
    {
      name: 'label',
    },
    expect.it('to have focus'),
  ],
});
```
