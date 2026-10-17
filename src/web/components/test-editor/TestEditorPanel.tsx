import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import {
  selectedTestPathAtom,
  testTreeAtom,
} from '../../stores/testEditorAtom';
import { useTestEditor } from '../../hooks/useTestEditor';
import { useTestTree } from '../../hooks/useTestTree';
import { TestCaseEditForm } from './TestCaseEditForm';
import { TestCaseCreateForm } from './TestCaseCreateForm';
import { TestEditorErrorBanner } from './TestEditorErrorBanner';
import type { TestTreeNode } from '../../../interfaces/TestTypes';
import './styles/TestEditorPanel.scss';

/**
 * カテゴリ一覧を抽出
 */
function extractCategories(nodes: TestTreeNode[], prefix = ''): string[] {
  const categories: string[] = [];
  for (const node of nodes) {
    if (node.type === 'directory') {
      const path = prefix ? `${prefix}/${node.name}` : node.name;
      categories.push(path);
      if (node.children) {
        categories.push(...extractCategories(node.children, path));
      }
    }
  }
  return categories;
}

/**
 * テストケース編集パネル
 */
export const TestEditorPanel: React.FC = () => {
  const selectedPath = useAtomValue(selectedTestPathAtom);
  const tree = useAtomValue(testTreeAtom);
  const {
    testCase,
    isDirty,
    isSaving,
    isCreateMode,
    error,
    loadTestCase,
    updateCheck,
    save,
    create,
    cancelCreate,
    clearError,
  } = useTestEditor();
  const { loadTree } = useTestTree();

  // Load test case when selection changes.
  // 選択が素早く切り替わったとき、古い読み込みの結果が反映されないよう cleanup で中断する
  useEffect(() => {
    if (!selectedPath || isCreateMode) return;
    const controller = new AbortController();
    void loadTestCase(selectedPath, controller.signal);
    return () => controller.abort();
  }, [selectedPath, isCreateMode]);

  const handleSave = async () => {
    // 失敗時は useTestEditor がエラーを表示用 atom に設定する
    if (await save()) {
      // Reload tree to reflect hasCheck changes
      await loadTree();
    }
  };

  const handleCreate = async (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }) => {
    // 成功時は作成したテストが選択され、読み込まれる
    if (await create(params)) {
      // Reload tree to reflect the new test
      await loadTree();
    }
  };

  const errorBanner = error ? (
    <TestEditorErrorBanner message={error} onDismiss={clearError} />
  ) : null;

  if (isCreateMode) {
    const categories = extractCategories(tree);
    return (
      <>
        {errorBanner}
        <TestCaseCreateForm
          categories={categories}
          source={testCase?.source || ''}
          onSubmit={handleCreate}
          onCancel={cancelCreate}
          isSaving={isSaving}
        />
      </>
    );
  }

  if (!testCase) {
    return (
      <div className="test-editor-panel">
        {errorBanner}
        <div className="test-editor-empty">Select a test case to edit</div>
      </div>
    );
  }

  return (
    <>
      {errorBanner}
      <TestCaseEditForm
        key={testCase.path}
        testCase={testCase}
        isDirty={isDirty}
        isSaving={isSaving}
        onCheckChange={updateCheck}
        onSave={handleSave}
      />
    </>
  );
};
