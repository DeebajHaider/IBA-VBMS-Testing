module.exports = {
  displayName: 'unit',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['<rootDir>/unit/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../iba-backend/src/$1',
  },
  setupFiles: ['reflect-metadata'],
};
