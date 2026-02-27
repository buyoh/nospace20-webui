import { atom } from 'jotai';
import type { CompileTarget } from '../../interfaces/NospaceTypes';

/** コンパイル結果（中間出力表示用） */
export interface CompileOutput {
  /** コンパイル結果テキスト */
  output: string;
  /** コンパイルに使用されたターゲット */
  target: CompileTarget;
}

/** コンパイル中間出力を保持する atom */
export const compileOutputAtom = atom<CompileOutput | null>(null);

/**
 * Whitespace 出力の表示モード。
 * - 'raw': そのまま表示（不可視文字のまま）
 * - 'visible': SP/TB/LF に置換して表示
 */
export type WhitespaceDisplayMode = 'raw' | 'visible';

/**
 * Whitespace 表示モード。
 * ws / ex-ws ターゲット出力時に通常表示と可視文字表示を切り替える。
 * デフォルトは 'visible'（ws 出力は不可視文字のため初回から可視表示）。
 */
export const whitespaceDisplayModeAtom = atom<WhitespaceDisplayMode>('visible');

/**
 * ページネーション: 現在のページ番号（0-based）。
 */
export const compileOutputPageAtom = atom<number>(0);

/**
 * ページネーション: 1 ページあたりの表示行数。
 */
export const compileOutputPageSizeAtom = atom<number>(100);
