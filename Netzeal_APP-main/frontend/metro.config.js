// Metro configuration for React Native / Expo SDK 49
// Provides stable resolver, asset handling, and projectRoot detection

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('metro-config').ConfigT} */
module.exports = (() => {
  const projectRoot = __dirname;
  const config = getDefaultConfig(projectRoot);

  // Ensure transformer/plugins are present (reanimated plugin handled by babel)
  config.resolver = config.resolver || {};
  config.transformer = config.transformer || {};

  // Extend asset extensions commonly used
  config.resolver.assetExts = config.resolver.assetExts || [];
  const extraAssets = ['db', 'mp3', 'wav', 'aac'];
  config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, ...extraAssets]));

  // Watch for packages one level up if monorepo (safe for single project)
  config.watchFolders = config.watchFolders || [path.resolve(projectRoot)];

  return config;
})();
