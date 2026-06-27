// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Prevent unsafe prototype access
      'no-prototype-builtins': 'error',
    },
    ignores: ['dist/*'],
  },
]);
