unexpected-dom
==============

[![NPM version](https://badge.fury.io/js/unexpected-dom.svg)](http://badge.fury.io/js/unexpected-dom)
[![Build Status](https://travis-ci.org/Munter/unexpected-dom.svg?branch=master)](https://travis-ci.org/Munter/unexpected-dom)
[![Coverage Status](https://img.shields.io/coveralls/Munter/unexpected-dom.svg?style=flat)](https://coveralls.io/r/Munter/unexpected-dom?branch=master)
[![Dependency Status](https://david-dm.org/Munter/unexpected-dom.svg)](https://david-dm.org/Munter/unexpected-dom)

![Unexpected Dom Perignon](https://raw.githubusercontent.com/Munter/unexpected-dom/master/documentation/unexpectedDom.jpg)

A plugin for [unexpected](https://unexpectedjs.github.io/) that adds custom assertions for DOM elements.

The aim is to lower the amount of mocking around in the DOM in your tests and keep your tests easily readable while providing a high powered set of functionality with unsurpassed error messages.


Installation and usage
----------------------

**NodeJS**

```
npm install unexpected unexpected-dom
```

**Bower**

```
bower install unexpected unexpected-dom
```

Setup in tests:

``` js
var expect = require('unexpected').clone();
expect.use(require('unexpected-dom'));

describe('in a document', function () {
  it('should find a DOM node', function () {
    expect(document.body, 'to have attributes', {
      id: 'app',
      lang: 'en-US'
    });
  });
});

```

Assertions
----------

Assertions that test none, singular an plural of a possible collection generally work in all the forms ou would expect. For example `to have no children`, `to have child`, `to have children`.

Brackets in an assertion means the word is an optional flag.

**To have attributes**

Tests for the existence of DOM element attributes. `class` attributes are treated arrays, but with set semantics disregarding sort order. `style` attributes are treated as key/value pairs, disregarding sort order. Both `class` and `style` comparisons can be done with strings, which will be converted into the corresponding format before comparison.

```js
expect(node, 'to [only] have attribute', 'id');
expect(node, 'to [only] have attributes', 'id', 'class');
expect(node, 'to [only] have attributes', ['id', 'class']);

expect(node, 'to [only] have attributes', {
  'id': 'foo',
  'aria-describedby': 'helpText'
});

// style and class string comparisons
expect(node, 'to [only] have attributes', {
  'class': 'bar baz',
  'style': 'background: red; color: blue'
});

// style and class highlevel set/object comparison
expect(node, 'to [only] have attributes', {
  'class': ['bar', 'baz'],
  'style': {
    background: 'red',
    color: 'blue'
  }
});
```

**Not to have attributes**

```js
expect(node, 'not to have attribute', 'id');
expect(node, 'not to have attributes', 'id', 'class');
expect(node, 'not to have attributes', ['id', 'class']);
```

**To have text**

Tests the text content of a DOM element

```js
expect(node, 'to have text', 'foo');
```

**To contain [no] elements matching**

Tests that the DOMElement has (no) elements matching the given selector

```js

// node = '<div> <span class="exists">sample</span> </div>'

expect(node, 'to contain elements matching', '.exists');
expect(node, 'to contain no elements matching', '.not-exists');
```


**To have children**

Tests the children of the DOMElement

```js

// node = '<div> <span class="one">sample</span><span class="two">sample2</span> </div>'

expect(node, 'to have children', [
  expect.it('to have attributes', { class: 'one' }),
  expect.it('to have attributes', { class: 'two' })
]);
```


**Queried for**

Queries the supplied node the designated [querySelector]() and returns a [NodeList](). NodeList is an [array-like]() type, giving you array assertions as an added bonus.

This assertion is primarily useful for chaining.

```js
expect(node, 'queried for [first]', '.blog-article > h2');

// Chaining
expect(node, 'queried for', '.blog-article', 'to have items satisfying', 'to have attributes', {
  id: /^article-heading-\d+$/,
  'aria-describe': 'Article'
});
```

**When parsed as HTML**

Parses the subject (string) as an HTML document using the facilities available in the browser, with a fallback to jsdom, then delegates to the next assertion in the argument list:

```js
expect(
    '<html><body><div class="foo"></div></body></html>',
    'when parsed as HTML',
    'queried for', 'div',
    'to have attributes', { class: 'foo' }
);
```


License
-------

License

(The MIT License)

Copyright (c) 2015 Peter Müller [munter@fumle.dk](mailto:munter@fumle.dk)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
