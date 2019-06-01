/*global expect:true, jsdom:true*/
/* eslint no-unused-vars: "off" */
expect = require('unexpected')
  .clone()
  .use(require('unexpected-snapshot'))
  .use(require('../../src/index'));
jsdom = require('jsdom');
