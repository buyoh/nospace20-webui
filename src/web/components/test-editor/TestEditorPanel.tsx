import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { selectedTestPathAtom, testTreeAtom } from '../../stores/testEditorAtom';
import { useTestEditor } from '../../hooks/useTestEditor';
import { useTestTree } from '../../hooks/useTestTree';
import { TestCaseEditForm } from './TestCaseEditForm';
import { TestCaseCreateForm } from './TestCaseCreateForm';
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
    loadTestCase,
    updateSource,
    updateCheck,
    save,
    create,
    cancelCreate,
  } = useTestEditor();
  const { loadTree } = useTestTree();

  // Load test case when selection changes
  useEffect(() => {
    if (selectedPath && !isCreateMode) {
      loadTestCase(selectedPath);
    }
  }, [selectedPath, isCreateMode]);

  const handleSave = async () => {
    try {
      await save();
      // Reload tree to reflect hasCheck changes
      await loadTree();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const handleCreate = async (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }) => {
    try {
      const path = await create(params);
      // Reload tree and select new test
      await loadTree();
      // TODO: select the newly created test
    } catch (err) {
      console.error('Create failed:', err);
    }
  };

  if (isCreateMode) {
    const categories = extractCategories(tree);
    return (
      <TestCaseCreateForm
        categories={categories}
        onSubmit={handleCreate}
        onCancel={cancelCreate}
        isSaving={isSaving}
      />
    );
  }

  if (!testCase) {
    return (
      <div className="test-editor-panel">
        <div className="test-editor-empty">
          Select a test case to edit
        </div>
      </div>
    );
  }

  return (
    <TestCaseEditForm
      testCase={testCase}
      isDirty={isDirty}
      isSaving={isSaving}
      onSourceChange={updateSource}
      onCheckChange={updateCheck}
      onSave={handleSave}
    />
  );
};
