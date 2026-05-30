module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tests/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/iba-backend/src/$1',
  },
  setupFiles: ['reflect-metadata'],
  testTimeout: 30000,
  globalSetup: '<rootDir>/tests/integration/helpers/globalSetup.ts',
};
