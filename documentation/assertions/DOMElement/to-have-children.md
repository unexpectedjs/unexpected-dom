Assert that a DOM element have children.

```js
var element = createElement(`
  <section>
    <h1>Numbers</h1>
    <hr>
    <ol>
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </ol>
  </section>
`);
```

```js
expect(element, 'queried for first', 'ol', 'to have children');
```

You get the following error when it fails:

```js
expect(element, 'queried for first', 'hr', 'to have children');
```

```output
expected
<section>
  <h1>Numbers</h1>
  <hr>
  <ol><li>...</li><li>...</li><li>...</li></ol>
</section>
queried for first hr to have children
  expected <hr> to have children
```

You can also assert that an element has no children:

```js
expect(element, 'queried for first', 'hr', 'to have no children');
```

When it fails you get this error:

```js
expect(element, 'queried for first', 'ol', 'to have no children');
```

```output
expected
<section>
  <h1>Numbers</h1>
  <hr>
  <ol><li>...</li><li>...</li><li>...</li></ol>
</section>
queried for first ol to have no children
  expected <ol><li>One</li><li>Two</li><li>Three</li></ol> to have no children
```
