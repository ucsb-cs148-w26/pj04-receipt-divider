import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@shared': resolve(__dirname, '../packages/shared/src'),
      '@components': resolve(__dirname, '../packages/shared/src/components'),
      '@utils': resolve(__dirname, '../packages/shared/src/utils'),
    },
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
});
