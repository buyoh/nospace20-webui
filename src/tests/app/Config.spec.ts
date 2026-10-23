import { parseAppConfig, ConfigError } from '../../app/Config';
import type { ExpectedEnvVars } from '../../interfaces/EnvConfig';

/** env.example.js 相当の完全な設定値 */
const validEnv = (overrides: ExpectedEnvVars = {}): ExpectedEnvVars => ({
  NODE_ENV: 'development',
  PORT: '8090',
  FRONTEND: 'vite',
  NOSPACE_BIN_PATH: './components/nospace20/bin/nospace20',
  NOSPACE_WHITESPACE_BIN_PATH: './components/nospace20/bin/whitespace20',
  NOSPACE_TIMEOUT: '30',
  NOSPACE_MAX_PROCESSES: '5',
  NOSPACE_TEST_DIR: './resources/tests',
  ...overrides,
});

describe('parseAppConfig', () => {
  it('env.example.js 相当の値をパースできる', () => {
    const config = parseAppConfig(validEnv());
    expect(config.production).toBe(false);
    expect(config.develop).toBe(true);
    expect(config.httpPort).toBe(8090);
    expect(config.frontend).toBe('vite');
    expect(config.nospaceBinPath).toBe('./components/nospace20/bin/nospace20');
    expect(config.whitespaceBinPath).toBe(
      './components/nospace20/bin/whitespace20'
    );
    expect(config.nospaceTimeout).toBe(30000);
    expect(config.nospaceMaxProcesses).toBe(5);
    expect(config.nospaceTestDir).toBe('./resources/tests');
  });

  it('production 環境を正しくパースする', () => {
    const config = parseAppConfig(validEnv({ NODE_ENV: 'production' }));
    expect(config.production).toBe(true);
    expect(config.develop).toBe(false);
  });

  it('カスタム値を正しくパースする', () => {
    const config = parseAppConfig(
      validEnv({
        PORT: '3000',
        FRONTEND: 'static',
        NOSPACE_BIN_PATH: '/usr/local/bin/nospace20',
        NOSPACE_TIMEOUT: '60',
        NOSPACE_MAX_PROCESSES: '10',
      })
    );
    expect(config.httpPort).toBe(3000);
    expect(config.frontend).toBe('static');
    expect(config.nospaceBinPath).toBe('/usr/local/bin/nospace20');
    expect(config.nospaceTimeout).toBe(60000);
    expect(config.nospaceMaxProcesses).toBe(10);
  });

  describe('未定義・空文字（コード側にデフォルト値を持たない）', () => {
    it.each([
      'NODE_ENV',
      'PORT',
      'FRONTEND',
      'NOSPACE_BIN_PATH',
      'NOSPACE_WHITESPACE_BIN_PATH',
      'NOSPACE_TIMEOUT',
      'NOSPACE_MAX_PROCESSES',
    ] as const)('%s が未定義なら ConfigError', (key) => {
      const env = validEnv();
      delete env[key];
      expect(() => parseAppConfig(env)).toThrow(ConfigError);
      expect(() => parseAppConfig(env)).toThrow(key);
    });

    it('必須項目が空文字なら ConfigError', () => {
      expect(() => parseAppConfig(validEnv({ NOSPACE_BIN_PATH: '' }))).toThrow(
        ConfigError
      );
    });

    it('NOSPACE_TEST_DIR は空文字を許容する（テスト API を無効にする）', () => {
      const config = parseAppConfig(validEnv({ NOSPACE_TEST_DIR: '' }));
      expect(config.nospaceTestDir).toBe('');
    });

    it('NOSPACE_TEST_DIR が未定義なら ConfigError', () => {
      const env = validEnv();
      delete env.NOSPACE_TEST_DIR;
      expect(() => parseAppConfig(env)).toThrow(ConfigError);
    });
  });

  describe('値の検証', () => {
    it('不正な FRONTEND 値は ConfigError', () => {
      expect(() => parseAppConfig(validEnv({ FRONTEND: 'invalid' }))).toThrow(
        ConfigError
      );
    });

    it.each(['abc', '30abc', '-1', '1.5', ' 5', '0x10'])(
      'BUG: NOSPACE_TIMEOUT=%s のような不正値は NaN にならず ConfigError（setTimeout(NaN) で全プロセスが即 kill されるのを防ぐ）',
      (value) => {
        expect(() =>
          parseAppConfig(validEnv({ NOSPACE_TIMEOUT: value }))
        ).toThrow(ConfigError);
      }
    );

    it('PORT は 1〜65535 の整数のみ', () => {
      expect(() => parseAppConfig(validEnv({ PORT: '0' }))).toThrow(
        ConfigError
      );
      expect(() => parseAppConfig(validEnv({ PORT: '70000' }))).toThrow(
        ConfigError
      );
      expect(() => parseAppConfig(validEnv({ PORT: 'abc' }))).toThrow(
        ConfigError
      );
      expect(parseAppConfig(validEnv({ PORT: '65535' })).httpPort).toBe(65535);
    });

    it('NOSPACE_MAX_PROCESSES は 1 以上', () => {
      expect(() =>
        parseAppConfig(validEnv({ NOSPACE_MAX_PROCESSES: '0' }))
      ).toThrow(ConfigError);
    });

    it('NOSPACE_TIMEOUT は 0 秒を許容しない', () => {
      expect(() => parseAppConfig(validEnv({ NOSPACE_TIMEOUT: '0' }))).toThrow(
        ConfigError
      );
    });
  });
});
