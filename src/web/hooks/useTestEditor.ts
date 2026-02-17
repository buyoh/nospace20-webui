import { useAtom, useSetAtom } from 'jotai';
import {
  editingTestCaseAtom,
  testEditorDirtyAtom,
  testEditorSavingAtom,
  testEditorCreateModeAtom,
} from '../stores/testEditorAtom';
import { TestApiClient, testApiClient } from '../services/TestApiClient';

/**
 * テストエディタの管理
 */
export function useTestEditor(client: TestApiClient = testApiClient) {
  const [testCase, setTestCase] = useAtom(editingTestCaseAtom);
  const [isDirty, setIsDirty] = useAtom(testEditorDirtyAtom);
  const [isSaving, setIsSaving] = useAtom(testEditorSavingAtom);
  const [isCreateMode, setIsCreateMode] = useAtom(testEditorCreateModeAtom);

  /**
   * テストケースをロード（選択変更時に呼ばれる）
   */
  const loadTestCase = async (path: string) => {
    try {
      const response = await client.fetchTestCase(path);
      setTestCase(response);
      setIsDirty(false);
    } catch (err: any) {
      console.error('Failed to load test case:', err);
      throw err;
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
   */
  const save = async () => {
    if (!testCase || !isDirty) return;

    setIsSaving(true);
    try {
      await client.updateTestCase(testCase.path, {
        source: testCase.source,
        check: testCase.check || undefined,
      });
      setIsDirty(false);
    } catch (err: any) {
      console.error('Failed to save test case:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 新規作成（カテゴリ + ファイル名 + ソース + check）
   */
  const create = async (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }) => {
    setIsSaving(true);
    try {
      const path = `${params.category}/${params.fileName}`;
      await client.createTestCase({
        path,
        source: params.source,
        check: params.check || undefined,
      });
      setIsCreateMode(false);
      return path;
    } catch (err: any) {
      console.error('Failed to create test case:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 新規作成モードを開始
   */
  const startCreate = () => {
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
   * 新規作成モードをキャンセル
   */
  const cancelCreate = () => {
    setIsCreateMode(false);
    setTestCase(null);
    setIsDirty(false);
  };

  return {
    testCase,
    isDirty,
    isSaving,
    isCreateMode,
    loadTestCase,
    updateSource,
    updateCheck,
    save,
    create,
    startCreate,
    cancelCreate,
  };
}
