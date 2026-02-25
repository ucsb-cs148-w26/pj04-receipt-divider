const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// Compatibility shim for environments where Array.prototype.toReversed is unavailable.
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value() {
      return [...this].reverse();
    },
    writable: true,
    configurable: true,
  });
}

let config = getDefaultConfig(__dirname);

config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts || []), 'cjs', 'mjs']),
);
config.watchFolders = [__dirname, path.resolve(__dirname, '../../shared')];
/**@ts-ignore */
config = withNativeWind(config, { input: '../../shared/styles/global.css' });

module.exports = config;
