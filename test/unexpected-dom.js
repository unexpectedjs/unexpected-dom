/*global describe, it, beforeEach*/
var unexpected = require('unexpected'),
    unexpectedDom = require('../lib/index'),
    jsdom = require('jsdom');

var expect = unexpected.clone().installPlugin(unexpectedDom);
expect.output.installPlugin(require('magicpen-prism'));

describe('unexpected-dom', function () {
  beforeEach(function (done) {
    var self = this;
    jsdom.env(' ', function (err, window) {
      self.window = window;
      self.document = window.document;
      self.body = window.document.body;

      done();
    });
  });

  it('should consider two DOM elements equal when they are of same type and have same attributes', function () {
    var document = this.document;

    var el1 = document.createElement('h1');
    var el2 = document.createElement('h1');
    var el3 = document.createElement('h1');
    el3.id = 'el3';
    var paragraph = document.createElement('p');

    expect(el1, 'to be', el1);
    expect(el1, 'not to be', el2);
    expect(el1, 'to equal', el2);
    expect(el1, 'not to equal', el3);
    expect(el1, 'not to equal', paragraph);
  });

  it('should to things', function () {
    //expect(this.document.createElement('p'), 'to match', '<p />');
  });

  describe('to have attributes', function () {
    describe('argument comparison', function () {
      it('should match exact arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to only have attributes', 'id', 'class', 'data-info', 'disabled');
      });

      it('should fail on exact arguments not met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to only have attributes', 'id');
        }, 'to throw exception', function (err) {
          expect(err.output.toString(), 'to match', 'expected <button class="bar" data-info="baz" disabled="" id="foo"/> to only have attributes \'id\'');
        });
      });

      it('should match partial arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'to have attributes', 'id', 'class');
      });

      it('should fail on partial arguments not met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'to have attributes', 'id', 'foo');
        }, 'to throw exception', function (err) {
          expect(err.output.toString(), 'to match', 'expected <button class="bar" data-info="baz" disabled="" id="foo"/> to have attributes \'id\', \'foo\'');
        });
      });

      it('should match negative arguments', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';

        expect(this.body.firstChild, 'not to have attributes', 'foo', 'bar');
      });

      it('should fail on negative partial arguments met', function () {
        this.body.innerHTML = '<button id="foo" class="bar" data-info="baz" disabled>Press me</button>';
        var el = this.body.firstChild;

        expect(function () {
          expect(el, 'not to have attributes', 'id');
        }, 'to throw exception', function (err) {
          expect(err.output.toString(), 'to match', 'expected <button class="bar" data-info="baz" disabled="" id="foo"/> not to have attributes \'id\'');
        });
      });
    });
  });

});
