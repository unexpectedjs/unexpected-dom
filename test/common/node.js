/* global expect:true, jsdom:true */
/* eslint no-unused-vars: "off" */
expect = require('unexpected')
  .clone()
  .use(require('unexpected-snapshot'))
  .use(require('../../src/index'));
jsdom = require('jsdom');

expect.addAssertion(
  '<function> to throw an error satisfying <assertion>',
  (expect, cb) =>
    expect(cb, 'to throw').then((err) => {
      expect.errorMode = 'nested';
      return expect.shift(
        err.isUnexpected ? err.getErrorMessage('text').toString() : err.message,
      );
    }),
);

module.exports = { expect, jsdom };
