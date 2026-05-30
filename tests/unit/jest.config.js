module.exports = {
  displayName: 'unit',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/tests/unit/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tests/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/iba-backend/src/$1',
  },
  setupFiles: ['reflect-metadata'],
};
