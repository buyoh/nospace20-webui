import { atom } from 'jotai';
import type { TestTreeNode } from '../../interfaces/TestTypes';

/** テストファイルツリー */
export const testTreeAtom = atom<TestTreeNode[]>([]);

/** 現在選択中のテストケースのパス（拡張子なし） */
export const selectedTestPathAtom = atom<string | null>(null);

/** テスト一覧のローディング状態 */
export const testTreeLoadingAtom = atom<boolean>(false);

/** テスト一覧のエラー */
export const testTreeErrorAtom = atom<string | null>(null);

/** 現在編集中のテストケースデータ */
export const editingTestCaseAtom = atom<{
  path: string;
  source: string;
  check: string | null;
} | null>(null);

/** エディタの変更状態（dirty flag） */
export const testEditorDirtyAtom = atom<boolean>(false);

/** 保存処理中 */
export const testEditorSavingAtom = atom<boolean>(false);

/** 新規作成モードか */
export const testEditorCreateModeAtom = atom<boolean>(false);
