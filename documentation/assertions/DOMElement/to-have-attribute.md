Assert that an element has one of more attributes.

```js
var element = createElement(`
  <div
    id="stock-info-box"
    class="callout info"
    aria-label="Information box"
    style="border: thin solid gray; padding: 12px"
  >
    The JS stock it up 9.5%
  </div>
`);

expect(element, 'to have attribute', 'id');
expect(element, 'to have attributes', 'id', 'class');
expect(element, 'to have attributes', ['id', 'class']);
```

In case of a failing expectation you get the following output:

```js
expect(element, 'to have attributes', 'id', 'class', 'data-test-id');
```

```output
expected <div aria-label="Information box" class="callout info" id="stock-info-box" style="border: thin solid gray; padding: 12px">The JS stock it up 9.5%</div>
to have attributes 'id', 'class', 'data-test-id'

<div id="stock-info-box" class="callout info" aria-label="Information box" style="border: thin solid gray; padding: 12px"
     // missing data-test-id
>The JS stock it up 9.5%</div>
```

You can also assert the values of the attributes, this uses [to
satisfy](http://unexpected.js.org/assertions/any/to-satisfy) samatics, which
means you only need to mention the expected tree of data you want to assert:

```js
expect(element, 'to have attributes', {
  'class': ['info'],
  'style': {
    border: 'thin solid gray'
  },
  id: /stock/
})
```

In case of a failing expectation you get the following output:

```js
expect(element, 'to have attributes', {
  'class': ['warning'],
  'style': {
    border: 'thick solid gray'
  },
  id: expect.it('to be a string')
})
```

```output
expected <div aria-label="Information box" class="callout info" id="stock-info-box" style="border: thin solid gray; padding: 12px">The JS stock it up 9.5%</div> to have attributes
{
  class: [ 'warning' ],
  style: { border: 'thick solid gray' },
  id: expect.it('to be a string')
}

<div id="stock-info-box" class="callout info" // expected [ 'callout', 'info' ] to contain 'warning'
     aria-label="Information box" style="border: thin solid gray; padding: 12px" // expected { border: 'thin solid gray', padding: '12px' }
                                                                                 // to satisfy { border: 'thick solid gray' }
                                                                                 //
                                                                                 // {
                                                                                 //   border:
                                                                                 //     'thin solid gray', // should equal 'thick solid gray'
                                                                                 //                        //
                                                                                 //                        // -thin solid gray
                                                                                 //                        // +thick solid gray
                                                                                 //   padding: '12px'
                                                                                 // }
>The JS stock it up 9.5%</div>
```

Using the `only` flag you can assert that the element only have the specified attributes.

```js
expect(element, 'to only have attributes', 'id', 'class', 'aria-label', 'style');
```

In case of a failing expectation you get the following output:

```js
expect(element, 'to only have attributes', 'id', 'aria-label');
```

```output
expected <div aria-label="Information box" class="callout info" id="stock-info-box" style="border: thin solid gray; padding: 12px">The JS stock it up 9.5%</div>
to only have attributes 'id', 'aria-label'

<div id="stock-info-box" class="callout info" // should be removed
     aria-label="Information box" style="border: thin solid gray; padding: 12px" // should be removed
>The JS stock it up 9.5%</div>
```
