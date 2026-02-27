import { defaultCode } from '../stores/editorAtom';

/** エディタ上で選択できるサンプルプログラムの型 */
export interface EditorSample {
  /** サンプルの表示名 */
  name: string;
  /** サンプルのソースコード */
  code: string;
}

/** 組み込みサンプルプログラム一覧 */
export const editorSamples: EditorSample[] = [
  {
    name: 'Hello World',
    code: defaultCode,
  },
];
