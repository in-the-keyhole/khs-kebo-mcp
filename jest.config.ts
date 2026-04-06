import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  setupFiles: ['./tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 60000, // testcontainers can be slow on first pull
  forceExit: true, // node-llama-cpp has top-level awaits that outlive the test runner
};

export default config;
