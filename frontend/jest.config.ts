import type { Config } from 'jest';

const config: Config = {
  projects: ['<rootDir>/apps/web', '<rootDir>/apps/mobile', '<rootDir>/shared'],
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/*.d.ts', '!**/node_modules/**'],
};

export default config;
