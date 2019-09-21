var terser = require('rollup-plugin-terser').terser;

var plugins = [
  require('rollup-plugin-json')(),
  require('rollup-plugin-commonjs')(),
  require('rollup-plugin-node-resolve')(),
  require('rollup-plugin-node-globals')()
];

module.exports = [
  {
    input: 'lib/index.js',
    output: {
      file: 'unexpected-dom.js',
      name: 'unexpected.dom',
      exports: 'named',
      format: 'umd',
      sourcemap: false,
      strict: false
    },
    plugins
  },
  {
    input: 'lib/index.js',
    output: {
      file: 'unexpected-dom.min.js',
      name: 'unexpected.dom',
      exports: 'named',
      format: 'umd',
      sourcemap: false,
      strict: false
    },
    plugins: plugins.concat([terser()])
  }
];
