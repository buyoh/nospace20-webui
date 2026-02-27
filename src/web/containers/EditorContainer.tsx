import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import type { Ace } from 'ace-builds';
import { sourceCodeAtom } from '../stores/editorAtom';
import { operationModeAtom, editingTestCaseAtom } from '../stores/testEditorAtom';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import { useTestEditor } from '../hooks/useTestEditor';
import { NospaceEditor } from '../components/editor/NospaceEditor';
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
}

export const EditorContainer: React.FC<EditorContainerProps> = ({
  NospaceEditorComponent: NospaceEditorImpl = NospaceEditor,
  useTestEditorHook = useTestEditor,
}) => {
  const [sourceCode, setSourceCode] = useAtom(sourceCodeAtom);
  const operationMode = useAtomValue(operationModeAtom);
  const editingTestCase = useAtomValue(editingTestCaseAtom);
  const compileErrors = useAtomValue(compileErrorsAtom);
  const { updateSource } = useTestEditorHook();

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

  return (
    <div className="editor-container">
      <NospaceEditorImpl value={displayValue} onChange={handleChange} annotations={annotations} />
    </div>
  );
};
