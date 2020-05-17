Assert that an element is the currently focused element on the page.

```js
var document = createDocument(`
  <button>
    Focused
  </button>
`);

var button = document.querySelector('button');
button.focus();

expect(button, 'to have focus');
```

In case of a failing expectation you get the following output:

```js
var document = createDocument(`
  <button>
    Not Focused
  </button>
`);

var button = document.querySelector('button');
button.blur();

expect(button, 'to have focus');
```

```output
expected <button>Not Focused</button> to have focus
```

## Combining with other assertions

You can combine this assertion with other assertions:

```js
var document = createDocument(`
  <form>
  <label>
    <span>Name</span>
    <input type="text">
  </label>
  <button>Focused</button>
  </form>
`);

var button = document.querySelector('button');
button.focus();

// Using a forwarding assertion
expect(document, 'queried for first', 'button', 'to have focus');

// Using a nested assertion call
var form = document.querySelector('form');
expect(form, 'to satisfy', {
  children: [
    {
      name: 'label',
    },
    expect.it('to have focus'),
  ],
});
```
