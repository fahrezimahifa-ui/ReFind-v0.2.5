const globals = require('globals');
module.exports = [{
  files: ['js/**/*.js', 'tools/**/*.cjs'],
  languageOptions: {ecmaVersion: 'latest', sourceType: 'script', globals: {...globals.browser, ...globals.node, $: 'readonly', jQuery: 'readonly', ReFind: 'readonly', ReFindTheme: 'readonly', PhotoUpload: 'readonly'}},
  rules: {'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-args': 'error', 'no-dupe-keys': 'error', 'no-constant-condition': ['error', {checkLoops: false}], 'constructor-super': 'error', 'valid-typeof': 'error'}
}];
