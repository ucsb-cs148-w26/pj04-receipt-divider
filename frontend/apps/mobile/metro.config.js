const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
let config = getDefaultConfig(__dirname);

config.resolver.sourceExts = ['ts', 'tsx', 'js', 'jsx', 'json'];
config.watchFolders = [__dirname, path.resolve(__dirname, '../../shared')];
/**@ts-ignore */
config = withNativeWind(config, { input: '../../shared/styles/global.css' });

module.exports = config;
