import { spawn } from 'child_process';
import type { ProcessSpawner } from './NospaceExecutionService';

/**
 * 子プロセス（nospace20）に引き継ぐ環境変数の許可リスト。
 * nospace20 はパス指定で起動され、引数のファイルと標準入出力だけを扱うため、
 * ロケールと panic 調査用の変数以外（PATH, HOME を含む）は渡さない。
 */
export const CHILD_PROCESS_ENV_ALLOWLIST = [
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'RUST_BACKTRACE',
] as const;

/** 許可リストにあり、値が定義されている環境変数だけを取り出す */
export function buildChildProcessEnv(
  source: Readonly<NodeJS.ProcessEnv>
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of CHILD_PROCESS_ENV_ALLOWLIST) {
    const value = source[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/**
 * 子プロセスに許可リストの環境変数だけを渡す ProcessSpawner を生成する。
 *
 * BUG FIX: 以前は spawn に env を指定しておらず、サーバーの全環境変数
 * （シェル由来の値や、当時 process.env に書き込んでいた設定ファイルの値）が子プロセスに渡っていた。
 * 解決策として、生成時に許可リストで絞り込んだ環境を計算し、spawn の env に指定する。
 *
 * @param env 絞り込み元の環境変数
 * @param spawnFn プロセス生成関数（テスト時に差し替える）
 */
export function createProcessSpawner(
  env: Readonly<NodeJS.ProcessEnv> = process.env,
  spawnFn: typeof spawn = spawn
): ProcessSpawner {
  const childEnv = buildChildProcessEnv(env);
  return {
    spawn: (command, args) => spawnFn(command, args, { env: childEnv }),
  };
}
