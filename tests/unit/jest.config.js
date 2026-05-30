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
    '^@nestjs/(.*)$': '<rootDir>/../iba-backend/node_modules/@nestjs/$1',
    '^reflect-metadata$': '<rootDir>/../iba-backend/node_modules/reflect-metadata',
  },
  setupFiles: [
    '<rootDir>/../iba-backend/node_modules/reflect-metadata/Reflect.js',
  ],
};

