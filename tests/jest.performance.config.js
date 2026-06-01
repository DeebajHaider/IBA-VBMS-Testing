module.exports = {
  displayName: 'performance:concurrency',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  testTimeout: 30000, // 30 seconds - concurrency tests may take longer
};
