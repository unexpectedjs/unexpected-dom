Assert that an element has one of more classes.

```js
var element = createElement('<div class="primary rounded">Fancy</div>')

expect(element, 'to have class', 'primary');
expect(element, 'to have classes', ['rounded', 'primary']);
```

In case of a failing expectation you get the following output:

```js
expect(element, 'to have class', 'squared')
```

```output
expected <div class="primary rounded">Fancy</div> to have class 'squared'

<div class="primary rounded" // expected [ 'primary', 'rounded' ] to contain 'squared'
>Fancy</div>
```

Using the `only` flag you can assert that the element only have the specified classes.

```js
expect(element, 'to only have classes', ['rounded', 'primary']);
```

```js
expect(element, 'to only have class', 'primary');
```

In case of a failing expectation you get the following output:

```output
expected <div class="primary rounded">Fancy</div> to only have class 'primary'

<div class="primary rounded" // expected [ 'primary', 'rounded' ] to equal [ 'primary' ]
                             //
                             // [
                             //   'primary',
                             //   'rounded' // should be removed
                             // ]
>Fancy</div>
```
