Assert that a child element is the currently focused element on the page.

```js
var document = createDocument(`
  <form>
  <label>
    <span>Name</span>
    <input type="text">
  </label>
  <button>Submit</button>
  </form>
`);

var button = document.querySelector('button');
button.focus();

expect(document, 'to contain focused element matching', 'button');
```

In case of a failing expectation you get the following output:

```js
button.blur();
expect(document, 'to contain focused element matching', 'button');
```

```output
expected <html><head></head><body>...</body></html>
to contain focused element matching 'button'
  expected <button>Submit</button> to have focus
```
