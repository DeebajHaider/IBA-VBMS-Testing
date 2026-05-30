module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/integration/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../iba-backend/src/$1',
  },
  setupFiles: ['reflect-metadata'],
  testTimeout: 30000,
  globalSetup: '<rootDir>/integration/helpers/globalSetup.ts',
};

