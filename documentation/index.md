---
template: default.ejs
theme: dark
title: unexpected-dom
repository: https://github.com/Munter/unexpected-dom
---

<div style="text-align: center; padding-bottom: 16px">
  <img src="https://raw.githubusercontent.com/Munter/unexpected-dom/master/documentation/unexpectedDom.jpg" alt="Unexpected Dom Perignon">
</div>

# unexpected-dom

[![NPM version](https://badge.fury.io/js/unexpected-dom.svg)](http://badge.fury.io/js/unexpected-dom)
[![Build Status](https://travis-ci.org/Munter/unexpected-dom.svg?branch=master)](https://travis-ci.org/Munter/unexpected-dom)
[![Coverage Status](https://img.shields.io/coveralls/Munter/unexpected-dom.svg?style=flat)](https://coveralls.io/r/Munter/unexpected-dom?branch=master)
[![Dependency Status](https://david-dm.org/Munter/unexpected-dom.svg)](https://david-dm.org/Munter/unexpected-dom)

A plugin for [unexpected](https://unexpectedjs.github.io/) that adds custom assertions for DOM elements.

The aim is to lower the amount of mocking around in the DOM in your tests and keep your tests easily readable while providing a high powered set of functionality with unsurpassed error messages.


## Installation

### NodeJS

```
npm install unexpected unexpected-dom
```

### Bower

```
bower install unexpected unexpected-dom
```

## Usage

```js#evaluate:false
const expect = require('unexpected').clone();
expect.installPlugin(require('unexpected-dom'));

describe('in a document', () => {
  it('should find a DOM node', () => {
    expect(document.body, 'to have attributes', {
      id: 'app',
      lang: 'en-US'
    });
  });
});
```

## License (The MIT License)

Copyright (c) 2015 Peter Müller [munter@fumle.dk](mailto:munter@fumle.dk)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
