import { atom } from 'jotai';
import type {
  ExecutionStatus,
  OutputEntry,
} from '../../interfaces/NospaceTypes';

/** 現在の実行状態 */
export const executionStatusAtom = atom<ExecutionStatus>('idle');
/** 現在実行中のセッション ID */
export const currentSessionIdAtom = atom<string | null>(null);
/** 出力パネルに表示するエントリの一覧 */
export const outputEntriesAtom = atom<OutputEntry[]>([]);
/** 最後の実行の終了コード */
export const exitCodeAtom = atom<number | null>(null);

/**
 * 実行バックエンドの状態。Run / Compile の有効条件は `kind === 'ready'` で判断する。
 * - initializing: WASM のロード中 / サーバへの接続中
 * - ready: 実行可能
 * - disconnected: サーバとの接続が切れ、自動再接続中
 * - error: 初期化に失敗した、またはサーバから切断された（Retry で再生成できる）
 */
export type BackendState =
  | { kind: 'initializing' }
  | { kind: 'ready' }
  | { kind: 'disconnected' }
  | { kind: 'error'; message: string };

/** 実行バックエンドの状態 */
export const backendStateAtom = atom<BackendState>({ kind: 'initializing' });
