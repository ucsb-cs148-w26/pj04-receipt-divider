/**@ts-ignore */
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
            // Mobile app aliases
            '@/': './src',
            '@/app': './app',
            '@/assets': './assets',
            // Shared package aliases (for imports within shared package files)
            '@': '../../shared/src',
            '@shared': '../../shared/src',
            '@styles': '../../shared/styles',
          },
        },
      ],
    ],
  };
};
