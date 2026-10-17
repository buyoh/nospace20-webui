import { useAtom } from 'jotai';
import {
  testTreeAtom,
  selectedTestPathAtom,
  testTreeLoadingAtom,
  testTreeErrorAtom,
  testEditorCreateModeAtom,
} from '../stores/testEditorAtom';
import { TestApiClient, testApiClient } from '../services/TestApiClient';
import {
  useDiscardChangesGuard,
  defaultConfirm,
  type ConfirmFn,
} from './useDiscardChangesGuard';

/**
 * テストツリーの管理
 */
export function useTestTree(
  client: TestApiClient = testApiClient,
  confirm: ConfirmFn = defaultConfirm
) {
  const [tree, setTree] = useAtom(testTreeAtom);
  const [selectedPath, setSelectedPath] = useAtom(selectedTestPathAtom);
  const [isLoading, setIsLoading] = useAtom(testTreeLoadingAtom);
  const [error, setError] = useAtom(testTreeErrorAtom);
  const [isCreateMode, setIsCreateMode] = useAtom(testEditorCreateModeAtom);
  const canDiscard = useDiscardChangesGuard(confirm);

  /**
   * テストツリーをサーバーから取得してatomに反映
   */
  const loadTree = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.fetchTree();
      setTree(response.tree);
    } catch (err: any) {
      setError(err.message || 'Failed to load test tree');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * テストケースを選択する。未保存の変更がある場合は破棄を確認し、拒否されたら選択を変えない。
   * 作成モード中に選択した場合は、作成モードを終了して選択したテストを読み込む。
   */
  const selectTest = (path: string) => {
    if (path === selectedPath && !isCreateMode) return;
    if (!canDiscard()) return;
    setIsCreateMode(false);
    setSelectedPath(path);
  };

  return {
    tree,
    selectedPath,
    isLoading,
    error,
    loadTree,
    selectTest,
  };
}
