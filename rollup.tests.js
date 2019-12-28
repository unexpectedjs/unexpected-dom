module.exports = {
  input: 'build/test/**/*.spec.js',
  output: {
    strict: false
  },
  plugins: require('@rollup/plugin-multi-entry')({ exports: false })
};
