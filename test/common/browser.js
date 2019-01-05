/*global expect:true*/
/* eslint no-unused-vars: "off" */
expect = window.weknowhow.expect.clone();
expect.installPlugin(window.weknowhow.unexpectedSinon);
expect.installPlugin(window.unexpected.dom);
