const { env } = require('process');

const testTarget = env.TEST_TARGET;
// default
let testMatch = ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'];

if (testTarget) {
  testMatch = testMatch.map(p => testTarget + p);
}

module.exports = {
  'roots': [
    '<rootDir>/src'
  ],
  'transform': {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  'testMatch': testMatch,
  'testEnvironment': 'jsdom',
  'setupFilesAfterEnv': ['<rootDir>/src/tests/setupTests.ts'],
  'moduleNameMapper': {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(css|less|scss)$': '<rootDir>/src/__mocks__/styleMock.js'
  },
  'globals': {
    'import.meta': {
      env: {}
    }
  }
};