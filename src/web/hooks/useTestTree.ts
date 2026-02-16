import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  testTreeAtom,
  selectedTestPathAtom,
  testTreeLoadingAtom,
  testTreeErrorAtom,
} from '../stores/testEditorAtom';
import { TestApiClient, testApiClient } from '../services/TestApiClient';

/**
 * テストツリーの管理
 */
export function useTestTree(client: TestApiClient = testApiClient) {
  const [tree, setTree] = useAtom(testTreeAtom);
  const [selectedPath, setSelectedPath] = useAtom(selectedTestPathAtom);
  const [isLoading, setIsLoading] = useAtom(testTreeLoadingAtom);
  const [error, setError] = useAtom(testTreeErrorAtom);

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
   * テストケースを選択
   */
  const selectTest = (path: string) => {
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
