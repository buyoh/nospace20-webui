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
