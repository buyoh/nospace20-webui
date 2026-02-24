import { atom } from 'jotai';
import type { NospaceErrorEntry } from '../libs/formatNospaceErrors';

/** コンパイルエラーの構造化情報を保持する atom */
export const compileErrorsAtom = atom<NospaceErrorEntry[]>([]);
