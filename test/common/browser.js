/* global expect:true */
/* eslint no-unused-vars: "off" */
expect = window.weknowhow.expect.clone();
expect.use(window.unexpected.dom);
expect.use(window.unexpectedSnapshot);

expect.addAssertion(
  '<function> to throw an error satisfying <assertion>',
  (expect, cb) =>
    expect(cb, 'to throw').then(err => {
      expect.errorMode = 'nested';
      return expect.shift(
        err.isUnexpected ? err.getErrorMessage('text').toString() : err.message
      );
    })
);
