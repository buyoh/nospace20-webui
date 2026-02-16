import React from 'react';
import { useTestEditor } from '../hooks/useTestEditor';
import { TestListPanel } from '../components/test-editor/TestListPanel';
import { TestEditorPanel } from '../components/test-editor/TestEditorPanel';
import './styles/TestEditorContainer.scss';

/**
 * テスト編集モード全体を統括するコンテナ
 */
export const TestEditorContainer: React.FC = () => {
  const { startCreate } = useTestEditor();

  return (
    <div className="test-editor-container">
      <div className="test-editor-list">
        <TestListPanel onCreateNew={startCreate} />
      </div>
      <div className="test-editor-panel-wrapper">
        <TestEditorPanel />
      </div>
    </div>
  );
};
