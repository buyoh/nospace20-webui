// for Server Configurations only

import type { ExpectedEnvVars } from '../interfaces/EnvConfig';

/** 設定値が不正・不足している場合に投げるエラー（起動を失敗させる） */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** サーバーアプリケーションの設定 */
export interface AppConfig {
  production: boolean;
  develop: boolean;
  httpPort: number;
  frontend: 'vite' | 'static';
  nospaceBinPath: string;
  /** プロセス実行タイムアウト（ミリ秒） */
  nospaceTimeout: number;
  nospaceMaxProcesses: number;
  /** テストファイルディレクトリ。空文字の場合はテスト管理 API を無効にする */
  nospaceTestDir: string;
}

/** 未定義・空文字を許容しない文字列を取り出す */
function requireString(env: ExpectedEnvVars, key: keyof ExpectedEnvVars) {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new ConfigError(
      `Environment variable ${key} is required (define it in .env.example or .env.local)`
    );
  }
  return value;
}

/** 範囲内の整数を取り出す。数値でない・範囲外の場合は起動を失敗させる */
function requireInteger(
  env: ExpectedEnvVars,
  key: keyof ExpectedEnvVars,
  min: number,
  max: number
): number {
  const raw = requireString(env, key);
  // parseInt('30abc') === 30 のように末尾の不正を見逃さないよう、全体が整数表記であることを確認する
  if (!/^\d+$/.test(raw)) {
    throw new ConfigError(`${key} must be an integer, got '${raw}'`);
  }
  const value = Number(raw);
  if (value < min || value > max) {
    throw new ConfigError(
      `${key} must be between ${min} and ${max}, got ${value}`
    );
  }
  return value;
}

/**
 * 環境変数をパース・検証してアプリケーション設定を生成する。
 *
 * コード側にデフォルト値は持たない。値は .env.example（および .env.local）で定義し、
 * 未定義・不正な値は ConfigError で起動を失敗させる（fail fast）。
 * 以前は不正な値が黙って既定値・NaN になっていた
 * （例: NOSPACE_TIMEOUT=abc → NaN → setTimeout(NaN) が即時発火し全プロセスが直後に kill される）。
 * 空文字を許容するのは NOSPACE_TEST_DIR のみ（テスト管理 API を無効にする）。
 */
export function parseAppConfig(env: ExpectedEnvVars): AppConfig {
  const nodeEnv = requireString(env, 'NODE_ENV');
  const production = nodeEnv === 'production';

  const frontend = requireString(env, 'FRONTEND');
  if (frontend !== 'vite' && frontend !== 'static') {
    throw new ConfigError(
      `FRONTEND must be 'vite' or 'static', got '${frontend}'`
    );
  }

  if (env.NOSPACE_TEST_DIR === undefined) {
    throw new ConfigError(
      'Environment variable NOSPACE_TEST_DIR is required (an empty value disables the test API)'
    );
  }

  return {
    production,
    develop: !production,
    httpPort: requireInteger(env, 'PORT', 1, 65535),
    frontend,
    nospaceBinPath: requireString(env, 'NOSPACE_BIN_PATH'),
    nospaceTimeout: requireInteger(env, 'NOSPACE_TIMEOUT', 1, 86400) * 1000,
    nospaceMaxProcesses: requireInteger(env, 'NOSPACE_MAX_PROCESSES', 1, 1000),
    nospaceTestDir: env.NOSPACE_TEST_DIR,
  };
}
