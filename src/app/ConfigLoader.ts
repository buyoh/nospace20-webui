import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { AppConfig, ConfigError, parseAppConfig } from './Config';
import type { ExpectedEnvVars } from '../interfaces/EnvConfig';

/** 環境変数ファイルの読み込み（テスト時に差し替えるため抽象化する） */
export interface EnvFileReader {
  /** ファイルの内容を返す。存在しない場合は null */
  read(path: string): string | null;
}

/** 実ファイルを読む EnvFileReader */
export const fsEnvFileReader: EnvFileReader = {
  read(path) {
    try {
      return readFileSync(path, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  },
};

/** 既定値の定義ファイル（必須）と、ローカル上書き用ファイル（任意） */
const DEFAULTS_FILE = '.env.example';
const LOCAL_FILE = '.env.local';

/**
 * 環境変数ファイルを読み込み、設定を生成する。
 *
 * 優先順位は process.env > .env.local > .env.example。
 * 読み込んだ値は、まだ定義されていない環境変数として env に反映する
 * （Vite など process.env を参照する他の部分が VITE_ 変数を参照できるようにするため）。
 *
 * .env.example は既定値の定義元なので存在しなければ ConfigError で起動を失敗させる。
 * import 時の副作用を避けるため、エントリポイントから明示的に呼び出す。
 *
 * @param reader 環境変数ファイルの読み込み
 * @param env 反映先の環境変数（省略時は process.env）
 */
export function loadAppConfig(
  reader: EnvFileReader = fsEnvFileReader,
  env: NodeJS.ProcessEnv = process.env
): AppConfig {
  const defaults = reader.read(DEFAULTS_FILE);
  if (defaults === null) {
    throw new ConfigError(
      `${DEFAULTS_FILE} not found. It defines the default values and is required to start the server`
    );
  }
  const local = reader.read(LOCAL_FILE);

  const merged = {
    ...dotenv.parse(defaults),
    ...(local !== null ? dotenv.parse(local) : {}),
  };
  for (const [key, value] of Object.entries(merged)) {
    if (env[key] === undefined) env[key] = value;
  }

  return parseAppConfig(env as ExpectedEnvVars);
}
