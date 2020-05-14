Assert that a child element is the currently focused element on the page.

```js
var element = createElement(`
  <form>
  <label>
    <span>Name</span>
    <input type="text">
  </label>
  <button>Submit</button>
  </form>
`);

element.querySelector('button').focus();

expect(element, 'to contain focused element matching', 'button');
```

In case of a failing expectation you get the following output:

```js
element.querySelector('button').blur();
expect(element, 'to contain focused element matching', 'button');
```

```output
expected
<form>
  <label><span>...</span><input type="text"></label>
  <button>Submit</button>
</form>
to contain focused element matching 'button'
  expected <button>Submit</button> to have focus
```
