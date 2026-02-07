import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
      },
    },
  },
];
