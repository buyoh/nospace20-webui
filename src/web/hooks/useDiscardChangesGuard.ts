import { useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { testEditorDirtyAtom } from '../stores/testEditorAtom';

/** 確認ダイアログ関数（テスト時に差し替えるため DI できるようにする） */
export type ConfirmFn = (message: string) => boolean;

/** ブラウザの確認ダイアログを使う既定の ConfirmFn */
export const defaultConfirm: ConfirmFn = (message) => window.confirm(message);

const DISCARD_MESSAGE = 'Unsaved changes will be lost. Continue?';

/**
 * 未保存の変更がある場合に破棄の確認を行い、続行してよいかを返す関数を提供する。
 * 変更がなければ確認せずに true を返す。
 *
 * BUG FIX: 以前は編集中に別のテストを選択したり新規作成を開始したりすると、
 * 確認なしに編集内容が破棄されていた。
 */
export function useDiscardChangesGuard(
  confirm: ConfirmFn = defaultConfirm
): () => boolean {
  const isDirty = useAtomValue(testEditorDirtyAtom);
  return useCallback(
    () => !isDirty || confirm(DISCARD_MESSAGE),
    [isDirty, confirm]
  );
}
