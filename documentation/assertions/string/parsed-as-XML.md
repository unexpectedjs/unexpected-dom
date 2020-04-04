Parses a string as an XML document using the facilities available in the browser, with a fallback to jsdom, then forwards the result to the next assertion in the argument list:

```js
expect(
  `<?xml version="1.0"?>
    <content>
      <hello type="greeting">World</hello>
    </content>
    `,
  'when parsed as XML',
  'queried for first',
  'hello',
  'to satisfy',
  {
    attributes: {
      type: 'greeting',
    },
    children: ['World'],
  }
);
```
