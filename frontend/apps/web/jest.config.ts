import type { Config } from 'jest';

const config: Config = {
  displayName: 'web',
  testEnvironment: 'jsdom',
  preset: 'ts-jest',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@shared$': '<rootDir>/../../shared/src/$1',
    '^@styles': '<rootDir>/../../shared/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
};

export default config;
