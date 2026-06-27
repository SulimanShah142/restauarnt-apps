const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 2;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'wasm'];

// Disable Metro caching in development to ensure changes are picked up
if (process.env.NODE_ENV !== 'production') {
  config.cacheVersion = Date.now().toString();
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @/ alias for imports
  if (moduleName.startsWith('@/')) {
    const relativePath = moduleName.substring(2);
    const resolvedPath = path.join(__dirname, relativePath);
    return context.resolveRequest(context, resolvedPath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
