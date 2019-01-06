/*global expect:true, jsdom:true, sinon:true*/
/* eslint no-unused-vars: "off" */
expect = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'))
  .use(require('../../src/index'));
jsdom = require('jsdom');
sinon = require('sinon');
