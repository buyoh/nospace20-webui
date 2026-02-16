import React, { useEffect } from 'react';
import { useTestTree } from '../../hooks/useTestTree';
import { TestTreeNode } from './TestTreeNode';
import './styles/TestListPanel.scss';

interface TestListPanelProps {
  onCreateNew: () => void;
}

/**
 * テスト一覧パネル
 */
export const TestListPanel: React.FC<TestListPanelProps> = ({ onCreateNew }) => {
  const { tree, selectedPath, isLoading, error, loadTree, selectTest } =
    useTestTree();

  useEffect(() => {
    loadTree();
  }, []);

  if (isLoading) {
    return (
      <div className="test-list-panel">
        <div className="test-list-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-list-panel">
        <div className="test-list-error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="test-list-panel">
      <div className="test-list-header">
        <button className="btn-new-test" onClick={onCreateNew}>
          + New Test
        </button>
      </div>
      <div className="test-list-tree">
        {tree.length === 0 ? (
          <div className="test-list-empty">No tests found</div>
        ) : (
          tree.map((node) => (
            <TestTreeNode
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              onSelect={selectTest}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
};
