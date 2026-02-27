import React, { useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import type { Ace } from 'ace-builds';
import { sourceCodeAtom } from '../stores/editorAtom';
import { operationModeAtom, editingTestCaseAtom } from '../stores/testEditorAtom';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import { useTestEditor } from '../hooks/useTestEditor';
import { NospaceEditor } from '../components/editor/NospaceEditor';
import { SampleList } from '../components/editor/SampleList';
import { editorSamples } from '../libs/editorSamples';
import './styles/EditorContainer.scss';

/** EditorContainer の Props */
interface EditorContainerProps {
  /**
   * テスト・DI 用: NospaceEditor コンポーネントの差し替え。
   * 省略時はデフォルトの NospaceEditor を使用する。
   */
  NospaceEditorComponent?: typeof NospaceEditor;
  /**
   * テスト・DI 用: useTestEditor フックの差し替え。
   * 省略時はデフォルトの useTestEditor を使用する。
   */
  useTestEditorHook?: () => Pick<ReturnType<typeof useTestEditor>, 'updateSource'>;
  /**
   * テスト・DI 用: SampleList コンポーネントの差し替え。
   * 省略時はデフォルトの SampleList を使用する。
   */
  SampleListComponent?: typeof SampleList;
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  NospaceEditorComponent: NospaceEditorImpl = NospaceEditor,
  useTestEditorHook = useTestEditor,
  SampleListComponent: SampleListImpl = SampleList,
}) => {
  const [sourceCode, setSourceCode] = useAtom(sourceCodeAtom);
  const operationMode = useAtomValue(operationModeAtom);
  const editingTestCase = useAtomValue(editingTestCaseAtom);
  const compileErrors = useAtomValue(compileErrorsAtom);
  const { updateSource } = useTestEditorHook();

  /** エディタエリアのアクティブタブ（"editor" | "sample"） */
  const [activeTab, setActiveTab] = useState<'editor' | 'sample'>('editor');

  // テストエディタモードの場合、テストケースのソースを表示
  const isTestEditorMode = operationMode === 'test-editor';
  const displayValue = isTestEditorMode ? (editingTestCase?.source || '') : sourceCode;
  const handleChange = isTestEditorMode ? updateSource : setSourceCode;

  // NospaceErrorEntry[] を Ace.Annotation[] に変換する（line がないエラーは指定不可なので除外）
  const annotations: Ace.Annotation[] = compileErrors
    .filter((e) => e.line != null)
    .map((e) => ({
      row: e.line! - 1, // Ace は 0-based row
      column: e.column ?? 0,
      text: e.message,
      type: 'error',
    }));

  /** サンプルを選択したとき: ソースに反映してエディタタブへ戻る */
  const handleLoadSample = (code: string) => {
    setSourceCode(code);
    setActiveTab('editor');
  };

  return (
    <div className="editor-container">
      <div className="editor-tabs">
        <button
          className={`editor-tab ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          Editor
        </button>
        <button
          className={`editor-tab ${activeTab === 'sample' ? 'active' : ''}`}
          onClick={() => setActiveTab('sample')}
        >
          Sample
        </button>
      </div>
      {activeTab === 'sample' ? (
        <SampleListImpl samples={editorSamples} onLoad={handleLoadSample} />
      ) : (
        <div className="editor-container__editor">
          <NospaceEditorImpl value={displayValue} onChange={handleChange} annotations={annotations} />
        </div>
      )}
    </div>
  );
};
