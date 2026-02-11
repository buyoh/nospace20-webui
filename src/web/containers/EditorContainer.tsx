import React from 'react';
import { useAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { CodeTextarea } from '../components/editor/CodeTextarea';
import './styles/EditorContainer.scss';

export const EditorContainer: React.FC = () => {
  const [sourceCode, setSourceCode] = useAtom(sourceCodeAtom);

  return (
    <div className="editor-container">
      <CodeTextarea value={sourceCode} onChange={setSourceCode} />
    </div>
  );
};
