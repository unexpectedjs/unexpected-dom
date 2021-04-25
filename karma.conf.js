module.exports = function (config) {
  config.set({
    frameworks: ['mocha'],

    files: [
      './node_modules/unexpected/unexpected.js',
      './node_modules/unexpected-snapshot/unexpected-snapshot-browser.js',
      './unexpected-dom.js',
      './test/common/browser.js',
      './build/tests.js',
    ],

    client: {
      mocha: {
        reporter: 'html',
        timeout: 60000,
      },
    },

    browserStack: {
      video: false,
      project:
        process.env.TRAVIS_BRANCH === 'master' &&
        !process.env.TRAVIS_PULL_REQUEST_BRANCH // Catch Travis "PR" builds
          ? 'unexpected-dom'
          : 'unexpected-dom-dev',
      // Attempt to fix timeouts on CI:
      // https://github.com/karma-runner/karma-browserstack-launcher/pull/168#issuecomment-582373514
      timeout: 1800,
    },

    browsers: ['ChromeHeadless', 'ie11'],

    customLaunchers: {
      ie11: {
        base: 'BrowserStack',
        browser: 'IE',
        browser_version: '11',
        os: 'Windows',
        os_version: '7',
      },
    },

    reporters: ['dots', 'BrowserStack'],
  });
};
