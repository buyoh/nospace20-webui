import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { operationModeAtom, editingTestCaseAtom } from '../stores/testEditorAtom';
import { useTestEditor } from '../hooks/useTestEditor';
import { NospaceEditor } from '../components/editor/NospaceEditor';
import './styles/EditorContainer.scss';

export const EditorContainer: React.FC = () => {
  const [sourceCode, setSourceCode] = useAtom(sourceCodeAtom);
  const operationMode = useAtomValue(operationModeAtom);
  const editingTestCase = useAtomValue(editingTestCaseAtom);
  const { updateSource } = useTestEditor();

  // テストエディタモードの場合、テストケースのソースを表示
  const isTestEditorMode = operationMode === 'test-editor';
  const displayValue = isTestEditorMode ? (editingTestCase?.source || '') : sourceCode;
  const handleChange = isTestEditorMode ? updateSource : setSourceCode;

  return (
    <div className="editor-container">
      <NospaceEditor value={displayValue} onChange={handleChange} />
    </div>
  );
};
