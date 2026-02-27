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
