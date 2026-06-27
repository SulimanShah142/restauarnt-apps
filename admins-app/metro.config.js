const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 2;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'wasm'];

// Add ttf to asset extensions so font files are properly loaded
config.resolver.assetExts = [...config.resolver.assetExts, 'ttf'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @/ alias for project imports
  if (moduleName.startsWith('@/')) {
    const relativePath = moduleName.substring(2);
    const resolvedPath = path.join(__dirname, relativePath);
    return context.resolveRequest(context, resolvedPath, platform);
  }

  // Don't block font files - let them load normally
  // Removed the font file redirect that was causing issues

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
