const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 2;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'wasm'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const relativePath = moduleName.substring(2);
    const resolvedPath = path.join(__dirname, relativePath);
    return context.resolveRequest(context, resolvedPath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
