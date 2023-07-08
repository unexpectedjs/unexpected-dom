/* global expect:true */
/* eslint no-unused-vars: "off" */
expect = window.weknowhow.expect.clone();
expect.use(window.unexpected.dom);
expect.use(window.unexpectedSnapshot);

expect.addAssertion(
  '<function> to throw an error satisfying <assertion>',
  function (expect, cb) {
    return expect(cb, 'to throw').then(function (err) {
      expect.errorMode = 'nested';
      return expect.shift(
        err.isUnexpected ? err.getErrorMessage('text').toString() : err.message,
      );
    });
  },
);
