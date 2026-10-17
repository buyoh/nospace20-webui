import { loadAppConfig, type EnvFileReader } from '../../app/ConfigLoader';
import { ConfigError } from '../../app/Config';

const EXAMPLE = `
NODE_ENV=development
PORT=8090
FRONTEND=vite
NOSPACE_BIN_PATH=./bin/nospace20
NOSPACE_TIMEOUT=30
NOSPACE_MAX_PROCESSES=5
NOSPACE_TEST_DIR=./resources/tests
VITE_APPLICATION_FLAVOR=websocket
`;

/** 実ファイルを読まないインメモリの EnvFileReader */
function readerOf(files: Record<string, string>): EnvFileReader {
  return { read: (path) => files[path] ?? null };
}

describe('loadAppConfig', () => {
  it('.env.example の値で設定を生成する', () => {
    const config = loadAppConfig(readerOf({ '.env.example': EXAMPLE }), {});

    expect(config.httpPort).toBe(8090);
    expect(config.nospaceBinPath).toBe('./bin/nospace20');
  });

  it('BUG: .env.example が存在しない場合は起動を失敗させる', () => {
    expect(() => loadAppConfig(readerOf({}), {})).toThrow(ConfigError);
    expect(() => loadAppConfig(readerOf({}), {})).toThrow('.env.example');
  });

  it('優先順位は process.env > .env.local > .env.example', () => {
    const env: NodeJS.ProcessEnv = { PORT: '1111' };
    const config = loadAppConfig(
      readerOf({
        '.env.example': EXAMPLE,
        '.env.local': 'PORT=2222\nNOSPACE_TIMEOUT=60\n',
      }),
      env
    );

    expect(config.httpPort).toBe(1111); // process.env が最優先
    expect(config.nospaceTimeout).toBe(60000); // .env.local が .env.example を上書き
    expect(config.nospaceMaxProcesses).toBe(5); // .env.example の値
  });

  it('未定義の環境変数のみ env に反映する（VITE_ 変数など他の参照元のため）', () => {
    const env: NodeJS.ProcessEnv = { PORT: '1111' };

    loadAppConfig(readerOf({ '.env.example': EXAMPLE }), env);

    expect(env.PORT).toBe('1111');
    expect(env.VITE_APPLICATION_FLAVOR).toBe('websocket');
  });

  it('.env.example の値が不正なら ConfigError', () => {
    const files = { '.env.example': EXAMPLE.replace('PORT=8090', 'PORT=abc') };

    expect(() => loadAppConfig(readerOf(files), {})).toThrow(ConfigError);
  });

  it('.env.local が無くても動作する', () => {
    expect(() =>
      loadAppConfig(readerOf({ '.env.example': EXAMPLE }), {})
    ).not.toThrow();
  });
});
