import React from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/theme-monokai';
import './nospace-ace-mode';
import './styles/NospaceEditor.scss';

/** Ace Editor を使用した Nospace エディタの Props */
interface NospaceEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const NospaceEditor: React.FC<NospaceEditorProps> = ({
  value,
  onChange,
}) => {
  return (
    <AceEditor
      mode="nospace"
      theme="monokai"
      name="nospace-editor"
      value={value}
      onChange={onChange}
      width="100%"
      height="100%"
      fontSize={14}
      showPrintMargin={false}
      showGutter={true}
      highlightActiveLine={true}
      setOptions={{
        enableBasicAutocompletion: false,
        enableLiveAutocompletion: false,
        enableSnippets: false,
        showLineNumbers: true,
        tabSize: 2,
        useWorker: false,
        wrap: false,
      }}
    />
  );
};
