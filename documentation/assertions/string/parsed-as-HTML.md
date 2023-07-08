Parses a string as a HTML document using the facilities available in the browser, with a fallback to jsdom, then forwards the result to the next assertion in the argument list:

```js
expect(
  '<html><body><div class="foo"></div></body></html>',
  'when parsed as HTML',
  'queried for first',
  'div',
  'to have attributes',
  { class: 'foo' },
);
```

You can also parse a HTML fragment:

```js
expect(
  '<div class="foo"></div>',
  'when parsed as HTML fragment',
  'queried for first',
  'div',
  'to have attributes',
  { class: 'foo' },
);
```
