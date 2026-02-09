module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@/': './src',
            '@/app': './app',
            '@/assets': './assets',
            '@shared': '../../shared/src',
            '@styles': '../../shared/styles',
          },
        },
      ],
    ],
  };
};
