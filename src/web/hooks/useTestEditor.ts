import { useAtom, useSetAtom } from 'jotai';
import {
  editingTestCaseAtom,
  testEditorDirtyAtom,
  testEditorSavingAtom,
  testEditorCreateModeAtom,
  testEditorErrorAtom,
  selectedTestPathAtom,
} from '../stores/testEditorAtom';
import { TestApiClient, testApiClient } from '../services/TestApiClient';
import {
  useDiscardChangesGuard,
  defaultConfirm,
  type ConfirmFn,
} from './useDiscardChangesGuard';

/** fetch の中断（AbortController.abort）によるエラーか */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * テストエディタの管理。
 * 読み込み・保存・作成の失敗は例外として投げず、testEditorErrorAtom に設定して UI に表示する。
 *
 * @param client テスト管理 API クライアント（テスト時に差し替える）
 * @param confirm 未保存変更の破棄確認に使う関数（テスト時に差し替える）
 */
export function useTestEditor(
  client: TestApiClient = testApiClient,
  confirm: ConfirmFn = defaultConfirm
) {
  const [testCase, setTestCase] = useAtom(editingTestCaseAtom);
  const [isDirty, setIsDirty] = useAtom(testEditorDirtyAtom);
  const [isSaving, setIsSaving] = useAtom(testEditorSavingAtom);
  const [isCreateMode, setIsCreateMode] = useAtom(testEditorCreateModeAtom);
  const [error, setError] = useAtom(testEditorErrorAtom);
  const setSelectedPath = useSetAtom(selectedTestPathAtom);
  const canDiscard = useDiscardChangesGuard(confirm);

  /**
   * テストケースをロード（選択変更時に呼ばれる）。
   *
   * BUG FIX: 以前は reject が呼び出し元の effect で未処理になり（unhandled rejection）、
   * 画面は前のテストケースのままになっていた。また A→B と素早く選択すると、レスポンスの
   * 順序が逆転して B を選択中に A の内容が表示されることがあった。
   * 解決策として、失敗はエラー atom に設定して表示し、signal で中断された古い読み込みの
   * 結果は反映しない。読み込み開始時に testCase を null にするため、読み込み中の編集で
   * 旧テストケースが dirty になり、完了時に黙って上書きされることもない。
   */
  const loadTestCase = async (path: string, signal?: AbortSignal) => {
    setError(null);
    setTestCase(null);
    setIsDirty(false);
    try {
      const response = await client.fetchTestCase(path, signal);
      if (signal?.aborted) return;
      setTestCase(response);
      setIsDirty(false);
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) return;
      console.error('Failed to load test case:', err);
      setError(`Failed to load test case: ${toMessage(err)}`);
    }
  };

  /**
   * ソースコードを更新
   */
  const updateSource = (source: string) => {
    if (testCase) {
      setTestCase({ ...testCase, source });
      setIsDirty(true);
    }
  };

  /**
   * check.json を更新
   */
  const updateCheck = (check: string) => {
    if (testCase) {
      setTestCase({ ...testCase, check });
      setIsDirty(true);
    }
  };

  /**
   * 保存
   * @returns 保存に成功したか（失敗時はエラー atom に設定される）
   */
  const save = async (): Promise<boolean> => {
    if (!testCase || !isDirty) return false;

    setError(null);
    setIsSaving(true);
    try {
      await client.updateTestCase(testCase.path, {
        source: testCase.source,
        // 空文字はサーバ側で .check.json の削除を意味する（null は変更なし）
        check: testCase.check ?? undefined,
      });
      setIsDirty(false);
      return true;
    } catch (err) {
      console.error('Failed to save test case:', err);
      setError(`Failed to save test case: ${toMessage(err)}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 新規作成（カテゴリ + ファイル名 + ソース + check）。
   * 成功したら作成したテストを選択する。
   * @returns 作成したテストのパス。失敗時は null（エラー atom に設定される）
   */
  const create = async (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }): Promise<string | null> => {
    setError(null);
    setIsSaving(true);
    try {
      const path = `${params.category}/${params.fileName}`;
      await client.createTestCase({
        path,
        source: params.source,
        check: params.check || undefined,
      });
      // 作成直後に作成フォーム用の仮データ（path: '(new test case)'）と dirty が残ると、
      // 編集フォームがそれを表示して保存できてしまう。作成したテストを選択して読み込み直す。
      setTestCase(null);
      setIsDirty(false);
      setIsCreateMode(false);
      setSelectedPath(path);
      return path;
    } catch (err) {
      console.error('Failed to create test case:', err);
      setError(`Failed to create test case: ${toMessage(err)}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 新規作成モードを開始（未保存の変更がある場合は確認する）
   */
  const startCreate = () => {
    if (!canDiscard()) return;
    setError(null);
    setIsCreateMode(true);
    // 新規作成用の空のテストケースをセット
    setTestCase({
      path: '(new test case)',
      source: '',
      check: '',
    });
    setIsDirty(false);
  };

  /**
   * 新規作成モードをキャンセル（入力済みの内容がある場合は確認する）
   */
  const cancelCreate = () => {
    if (!canDiscard()) return;
    setError(null);
    setIsCreateMode(false);
    setTestCase(null);
    setIsDirty(false);
  };

  const clearError = () => setError(null);

  return {
    testCase,
    isDirty,
    isSaving,
    isCreateMode,
    error,
    loadTestCase,
    updateSource,
    updateCheck,
    save,
    create,
    startCreate,
    cancelCreate,
    clearError,
  };
}
