import {
  loadAppConfig,
  loadConfigValues,
  type ConfigFileReader,
} from '../../app/ConfigLoader';
import { ConfigError } from '../../app/Config';

const EXAMPLE = {
  NODE_ENV: 'development',
  PORT: 8090,
  FRONTEND: 'vite',
  NOSPACE_BIN_PATH: './bin/nospace20',
  NOSPACE_TIMEOUT: 30,
  NOSPACE_MAX_PROCESSES: 5,
  NOSPACE_TEST_DIR: './resources/tests',
  VITE_APPLICATION_FLAVOR: 'websocket',
};

/** 実ファイルを読まないインメモリの ConfigFileReader */
function readerOf(files: Record<string, unknown>): ConfigFileReader {
  return {
    read: (fileName) =>
      fileName in files
        ? { found: true, value: files[fileName] }
        : { found: false },
  };
}

describe('loadAppConfig', () => {
  it('env.example.js の値で設定を生成する', () => {
    const config = loadAppConfig(readerOf({ 'env.example.js': EXAMPLE }), {});

    expect(config.httpPort).toBe(8090);
    expect(config.nospaceBinPath).toBe('./bin/nospace20');
  });

  it('BUG: env.example.js が存在しない場合は起動を失敗させる', () => {
    expect(() => loadAppConfig(readerOf({}), {})).toThrow(ConfigError);
    expect(() => loadAppConfig(readerOf({}), {})).toThrow('env.example.js');
  });

  it('優先順位は 環境変数 > env.local.js > env.example.js', () => {
    const env: NodeJS.ProcessEnv = { PORT: '1111' };
    const config = loadAppConfig(
      readerOf({
        'env.example.js': EXAMPLE,
        'env.local.js': { PORT: 2222, NOSPACE_TIMEOUT: '60' },
      }),
      env
    );

    expect(config.httpPort).toBe(1111); // 環境変数が最優先
    expect(config.nospaceTimeout).toBe(60000); // env.local.js が env.example.js を上書き
    expect(config.nospaceMaxProcesses).toBe(5); // env.example.js の値
  });

  it('BUG: 設定ファイルの値を env に書き込まない（子プロセスへ渡さないため）', () => {
    const env: NodeJS.ProcessEnv = { PORT: '1111' };

    const values = loadConfigValues(
      readerOf({ 'env.example.js': EXAMPLE }),
      env
    );

    expect(env).toEqual({ PORT: '1111' });
    expect(values.VITE_APPLICATION_FLAVOR).toBe('websocket');
  });

  it('設定キー以外の環境変数は取り込まない', () => {
    const values = loadConfigValues(readerOf({ 'env.example.js': EXAMPLE }), {
      SECRET_TOKEN: 'x',
    });

    expect(values).not.toHaveProperty('SECRET_TOKEN');
  });

  it('env.example.js の値が不正なら ConfigError', () => {
    const files = { 'env.example.js': { ...EXAMPLE, PORT: 'abc' } };

    expect(() => loadAppConfig(readerOf(files), {})).toThrow(ConfigError);
  });

  it('未知のキー（綴り間違い）は ConfigError', () => {
    const files = {
      'env.example.js': EXAMPLE,
      'env.local.js': { NOSPACE_TIMEOTU: 60 },
    };

    expect(() => loadAppConfig(readerOf(files), {})).toThrow(
      "env.local.js: unknown key 'NOSPACE_TIMEOTU'"
    );
  });

  it('文字列・数値以外の値やオブジェクト以外の export は ConfigError', () => {
    expect(() =>
      loadAppConfig(
        readerOf({ 'env.example.js': { ...EXAMPLE, PORT: true } }),
        {}
      )
    ).toThrow(ConfigError);
    expect(() =>
      loadAppConfig(readerOf({ 'env.example.js': 'PORT=8090' }), {})
    ).toThrow(ConfigError);
  });

  it('env.local.js が無くても動作する', () => {
    expect(() =>
      loadAppConfig(readerOf({ 'env.example.js': EXAMPLE }), {})
    ).not.toThrow();
  });
});
