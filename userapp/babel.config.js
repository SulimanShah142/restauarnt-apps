module.exports = function(api) {
  // Disable caching to ensure changes are picked up immediately
  api.cache(false);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      'react-native-reanimated/plugin', // This must be the last plugin
    ],
  };
};