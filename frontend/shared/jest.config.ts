import type { Config } from 'jest';

const config: Config = {
  displayName: 'shared',
  testEnvironment: 'jsdom',
  preset: 'ts-jest',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  }
};

export default config;
