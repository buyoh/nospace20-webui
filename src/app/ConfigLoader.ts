import { existsSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { AppConfig, ConfigError, parseAppConfig } from './Config';
import type { ExpectedEnvVars } from '../interfaces/EnvConfig';

/** 設定ファイルの読み込み結果 */
export type ConfigFileReadResult =
  | { found: true; value: unknown }
  | { found: false };

/** 設定ファイルの読み込み（テスト時に差し替えるため抽象化する） */
export interface ConfigFileReader {
  /** ファイルの export を返す。ファイルが存在しない場合は { found: false } */
  read(fileName: string): ConfigFileReadResult;
}

/** カレントディレクトリの CommonJS ファイルを require する ConfigFileReader */
export const fsConfigFileReader: ConfigFileReader = {
  read(fileName) {
    const absPath = path.resolve(process.cwd(), fileName);
    if (!existsSync(absPath)) return { found: false };
    // vite.config.ts（ESM としてバンドルされる場合がある）からも使うため、
    // グローバルの require ではなく createRequire を使う
    return { found: true, value: createRequire(absPath)(absPath) };
  },
};

/** 既定値の定義ファイル（必須）と、ローカル上書き用ファイル（任意） */
const DEFAULTS_FILE = 'env.example.js';
const LOCAL_FILE = 'env.local.js';

/** 設定ファイル・環境変数で指定できるキーの一覧 */
export const CONFIG_KEYS = [
  'NODE_ENV',
  'VITE_APPLICATION_FLAVOR',
  'VITE_BASE_PATH',
  'PORT',
  'FRONTEND',
  'NOSPACE_BIN_PATH',
  'NOSPACE_WHITESPACE_BIN_PATH',
  'NOSPACE_TIMEOUT',
  'NOSPACE_MAX_PROCESSES',
  'NOSPACE_TEST_DIR',
  'VITE_NOSPACE_VERSION',
  'VITE_WEBUI_VERSION',
] as const satisfies readonly (keyof ExpectedEnvVars)[];

type ConfigKey = (typeof CONFIG_KEYS)[number];

// ExpectedEnvVars にキーを追加して CONFIG_KEYS に追加し忘れた場合に型エラーにする
const _allKeysListed: [Exclude<keyof ExpectedEnvVars, ConfigKey>] extends [
  never,
]
  ? true
  : false = true;
void _allKeysListed;

function isConfigKey(key: string): key is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(key);
}

/**
 * 設定ファイルの export を検証し、キー → 文字列の値に正規化する。
 * 未知のキー（綴り間違いで黙って既定値が使われるのを防ぐ）と、文字列・数値以外の値は ConfigError。
 */
function normalizeConfigFile(
  fileName: string,
  value: unknown
): ExpectedEnvVars {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigError(
      `${fileName} must export an object (module.exports = { ... })`
    );
  }
  const result: ExpectedEnvVars = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isConfigKey(key)) {
      throw new ConfigError(`${fileName}: unknown key '${key}'`);
    }
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new ConfigError(
        `${fileName}: ${key} must be a string or a number, got ${typeof raw}`
      );
    }
    result[key] = String(raw);
  }
  return result;
}

/**
 * 設定ファイルと環境変数をマージした設定値を返す。
 *
 * 優先順位は 環境変数 > env.local.js > env.example.js。
 * env.example.js は既定値の定義元なので存在しなければ ConfigError で起動を失敗させる。
 *
 * BUG FIX: 以前は .env.example / .env.local の値を process.env に書き込んでおり
 * （Vite に VITE_ 変数を見せるため）、spawn した子プロセスに設定ファイルの値を含む全環境変数が渡っていた。
 * 解決策として設定ファイルを環境変数とは別の形式（JS）にし、値は env に書き込まずに返す。
 * Vite へは vite.config.ts が本関数で読み込んで define で渡す。
 *
 * @param reader 設定ファイルの読み込み
 * @param env 上書きに使う環境変数（読み取りのみ）
 */
export function loadConfigValues(
  reader: ConfigFileReader,
  env: Readonly<NodeJS.ProcessEnv>
): ExpectedEnvVars {
  const defaults = reader.read(DEFAULTS_FILE);
  if (!defaults.found) {
    throw new ConfigError(
      `${DEFAULTS_FILE} not found. It defines the default values and is required to start the server`
    );
  }
  const local = reader.read(LOCAL_FILE);

  const merged: ExpectedEnvVars = {
    ...normalizeConfigFile(DEFAULTS_FILE, defaults.value),
    ...(local.found ? normalizeConfigFile(LOCAL_FILE, local.value) : {}),
  };
  for (const key of CONFIG_KEYS) {
    const value = env[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/**
 * 設定ファイルと環境変数を読み込み、検証済みのアプリケーション設定を生成する。
 * import 時の副作用を避けるため、エントリポイントから明示的に呼び出す。
 *
 * @param reader 設定ファイルの読み込み
 * @param env 上書きに使う環境変数（省略時は process.env。書き込みはしない）
 */
export function loadAppConfig(
  reader: ConfigFileReader = fsConfigFileReader,
  env: Readonly<NodeJS.ProcessEnv> = process.env
): AppConfig {
  return parseAppConfig(loadConfigValues(reader, env));
}
