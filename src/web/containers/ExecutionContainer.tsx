import React, { useState, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { executionOptionsAtom } from '../stores/optionsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import { operationModeAtom } from '../stores/testEditorAtom';
import { sourceCodeAtom } from '../stores/editorAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { CompileOptions } from '../components/execution/CompileOptions';
import { CompileOutputPanel } from '../components/execution/CompileOutputPanel';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { SampleList } from '../components/editor/SampleList';
import { editorSamples } from '../libs/editorSamples';
import { useNospaceExecution, type BackendFactory } from '../hooks/useNospaceExecution';
import { TestEditorContainer } from './TestEditorContainer';
import './styles/ExecutionContainer.scss';

/** ExecutionContainer の Props */
interface ExecutionContainerProps {
  /** テスト用バックエンドファクトリ（依存性注入） */
  backendFactory?: BackendFactory;
  /**
   * テスト・DI 用: 子コンポーネントの差し替え。
   * 省略時は各コンポーネントのデフォルト実装を使用する。
   */
  components?: {
    TestEditorContainer?: React.ComponentType;
    ExecutionOptions?: React.ComponentType<any>;
    CompileOptions?: React.ComponentType<any>;
    OutputPanel?: React.ComponentType<any>;
    InputPanel?: React.ComponentType<any>;
    SampleList?: typeof SampleList;
  };
}

/**
 * 実行パネル全体を統括するコンテナ。
 * Compile / Run / Run(Direct) / TestEditor の4タブ構成。
 * Flavor に応じて利用可能なタブのみを表示する。
 */
export const ExecutionContainer: React.FC<ExecutionContainerProps> = ({ backendFactory, components }) => {
  const {
    TestEditorContainer: TestEditorContainerImpl = TestEditorContainer,
    ExecutionOptions: ExecutionOptionsImpl = ExecutionOptions,
    CompileOptions: CompileOptionsImpl = CompileOptions,
    OutputPanel: OutputPanelImpl = OutputPanel,
    InputPanel: InputPanelImpl = InputPanel,
    SampleList: SampleListImpl = SampleList,
  } = components ?? {};

  const flavor = useAtomValue(flavorAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [batchInput, setBatchInput] = useState('');
  const [operationMode, setOperationMode] = useAtom(operationModeAtom);
  const setSourceCode = useSetAtom(sourceCodeAtom);
  const [compileOutputCollapsed, setCompileOutputCollapsed] = useState(true);

  // Compile/Run: コンパイル完了後に自動実行するためのペンディング入力データ。null は待機中でないことを示す
  const pendingAutoRunRef = useRef<{ batchInput: string } | null>(null);

  const {
    isRunning,
    handleRun,
    handleCompile,
    handleRunCompileOutput,
    handleKill,
    handleSendStdin,
    handleClearOutput,
    compileOutput,
    compileStatus,
  } = useNospaceExecution(backendFactory);

  const isWasm = flavor === 'wasm';
  const isWebSocket = flavor === 'websocket';

  // コンパイル成功後はパネルを折りたたむ、エラー時は展開する
  useEffect(() => {
    if (compileStatus === 'success') {
      setCompileOutputCollapsed(true);
    } else if (compileStatus === 'error') {
      setCompileOutputCollapsed(false);
    }
  }, [compileStatus]);

  // Compile/Run: コンパイル完了後に自動的にコンパイル済みコードを実行する
  useEffect(() => {
    if (pendingAutoRunRef.current === null) return;
    if (compileStatus === 'success' && compileOutput?.target === 'ws') {
      const { batchInput: pendingInput } = pendingAutoRunRef.current;
      pendingAutoRunRef.current = null;
      handleRunCompileOutput(compileOutput.output, pendingInput);
    } else if (compileStatus === 'error') {
      pendingAutoRunRef.current = null;
    }
  }, [compileStatus, compileOutput, handleRunCompileOutput]);

  // WASM flavor は run-direct / test-editor 非対応のため compile に強制リダイレクト
  useEffect(() => {
    if (isWasm && (operationMode === 'run-direct' || operationMode === 'test-editor')) {
      setOperationMode('compile');
    }
  }, [isWasm, operationMode]);

  /** サンプルをロードしてコンパイルタブへ切り替える */
  const handleLoadSample = (code: string) => {
    setSourceCode(code);
    setOperationMode('compile');
  };

  const handleRunWithInput = () => {
    const inputMode = isWasm ? 'batch' : executionOptions.inputMode;
    handleRun(inputMode === 'batch' ? batchInput : undefined);
  };

  const handleRunCompiled = () => {
    if (compileOutput?.target === 'ws') {
      handleRunCompileOutput(compileOutput.output, batchInput);
    }
  };

  /** コンパイル完了後に自動実行する（Run タブの Compile/Run ボタン用） */
  const handleCompileAndRun = () => {
    pendingAutoRunRef.current = { batchInput };
    handleCompile();
  };

  const canRunCompiled = compileOutput !== null && compileOutput.target === 'ws';

  return (
    <div className="execution-container">
      {/* モード切り替えタブ */}
      <div className="operation-mode-tabs">
        <button
          className={`mode-tab ${operationMode === 'compile' ? 'active' : ''}`}
          onClick={() => setOperationMode('compile')}
        >
          Compile
        </button>
        <button
          className={`mode-tab ${operationMode === 'run' ? 'active' : ''}`}
          onClick={() => setOperationMode('run')}
        >
          Run
        </button>
        {isWebSocket && (
          <button
            className={`mode-tab ${operationMode === 'run-direct' ? 'active' : ''}`}
            onClick={() => setOperationMode('run-direct')}
          >
            Run(Direct)
          </button>
        )}
        {isWebSocket && (
          <button
            className={`mode-tab ${operationMode === 'test-editor' ? 'active' : ''}`}
            onClick={() => setOperationMode('test-editor')}
          >
            Test Editor
          </button>
        )}
        <button
          className={`mode-tab ${operationMode === 'sample' ? 'active' : ''}`}
          onClick={() => setOperationMode('sample')}
        >
          Sample
        </button>
      </div>

      {operationMode === 'sample' ? (
        <SampleListImpl samples={editorSamples} onLoad={handleLoadSample} />
      ) : operationMode === 'test-editor' ? (
        <TestEditorContainerImpl />
      ) : operationMode === 'compile' ? (
        <>
          {/* Compile タブ: コンパイルのみ */}
          <CompileOptionsImpl />
          <ExecutionControls
            isRunning={isRunning}
            onCompile={handleCompile}
            onKill={handleKill}
            compileStatus={compileStatus}
          />
          <CompileOutputPanel
            compileOutput={compileOutput}
            isRunning={isRunning}
            collapsed={compileOutputCollapsed}
            onToggleCollapse={() => setCompileOutputCollapsed((prev) => !prev)}
          />
          <OutputPanelImpl onClear={handleClearOutput} />
        </>
      ) : operationMode === 'run' ? (
        <>
          {/* Run タブ: コンパイル済みコードの実行 */}
          <ExecutionOptionsImpl />
          <ExecutionControls
            isRunning={isRunning}
            onCompileAndRun={handleCompileAndRun}
            onRun={handleRunCompiled}
            runDisabled={!canRunCompiled}
            onKill={handleKill}
          />
          <OutputPanelImpl onClear={handleClearOutput} />
          <InputPanelImpl
            isRunning={isRunning}
            onSendStdin={handleSendStdin}
            batchInput={batchInput}
            onBatchInputChange={setBatchInput}
            forceBatchMode={true}
          />
        </>
      ) : (
        <>
          {/* Run(Direct) タブ: 従来の Execution モード相当 */}
          <ExecutionOptionsImpl />
          <ExecutionControls
            isRunning={isRunning}
            onRun={handleRunWithInput}
            onKill={handleKill}
          />
          <OutputPanelImpl onClear={handleClearOutput} />
          <InputPanelImpl
            isRunning={isRunning}
            onSendStdin={handleSendStdin}
            batchInput={batchInput}
            onBatchInputChange={setBatchInput}
            forceBatchMode={isWasm}
          />
        </>
      )}
    </div>
  );
};
