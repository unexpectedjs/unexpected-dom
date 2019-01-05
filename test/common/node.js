/*global expect:true, jsdom:true, sinon:true*/
/* eslint no-unused-vars: "off" */
expect = require('unexpected')
  .clone()
  .installPlugin(require('unexpected-sinon'))
  .installPlugin(require('../../src/index'));
jsdom = require('jsdom');
sinon = require('sinon');
