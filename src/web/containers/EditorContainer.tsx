import React from 'react';
import { useAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { NospaceEditor } from '../components/editor/NospaceEditor';
import './styles/EditorContainer.scss';

export const EditorContainer: React.FC = () => {
  const [sourceCode, setSourceCode] = useAtom(sourceCodeAtom);

  return (
    <div className="editor-container">
      <NospaceEditor value={sourceCode} onChange={setSourceCode} />
    </div>
  );
};
