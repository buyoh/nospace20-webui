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
    }],
    // nospace20_bg.js は ESM 形式のため, ts-jest で CJS に変換する
    '^.+nospace20_bg\\.js$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      diagnostics: false,
    }],
  },
  'testMatch': testMatch,
  'testEnvironment': 'jsdom',
  'setupFilesAfterEnv': ['<rootDir>/src/tests/setupTests.ts'],
  'moduleNameMapper': {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(css|less|scss)$': '<rootDir>/src/__mocks__/styleMock.js',
    // env.ts は import.meta.env を使用しており Jest (CommonJS) ではパース不可のためモックに差し替え
    '(.*/|\\.\\./)libs/env$': '<rootDir>/src/__mocks__/web/libs/env.ts',
    // react-ace は Jest 環境でロード不可のため静的スタブに差し替え
    '^react-ace$': '<rootDir>/src/__mocks__/react-ace.js',
    // ace-builds のテーマ・モードインポートは副作用のみのためスタブ化
    '^ace-builds/.*$': '<rootDir>/src/__mocks__/styleMock.js',
    // nospace-ace-mode は ace-builds 依存のためスタブ化
    '.*/nospace-ace-mode$': '<rootDir>/src/__mocks__/styleMock.js',
  }
};