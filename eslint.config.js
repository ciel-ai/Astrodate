// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // React Native text often includes apostrophes/quotes in <Text> nodes.
      // This web-focused rule is noisy and currently blocks lint.
      'react/no-unescaped-entities': 'off',

      // Allow inline component patterns used in screen files.
      'react/display-name': 'off',
    },
  },
]);
