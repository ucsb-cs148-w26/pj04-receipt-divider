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

// SVG transformer must be configured before withNativeWind so NativeWind
// chains its CSS transformer on top of it (NativeWind → SVG → Babel).
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...new Set([...resolver.sourceExts, 'svg', 'cjs', 'mjs'])],
};
config.watchFolders = [__dirname, path.resolve(__dirname, '../../shared')];
/**@ts-ignore */
config = withNativeWind(config, { input: '../../shared/styles/global.css' });

module.exports = config;
