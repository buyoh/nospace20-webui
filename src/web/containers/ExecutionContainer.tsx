import React, { useState, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { flavorAtom } from '../stores/flavorAtom';
import { operationModeAtom } from '../stores/testEditorAtom';
import { sourceCodeAtom } from '../stores/editorAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { CompileOptions } from '../components/execution/CompileOptions';
import { CompileOutputPanel } from '../components/execution/CompileOutputPanel';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { BackendStatusBar } from '../components/execution/BackendStatusBar';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { SampleList } from '../components/editor/SampleList';
import { editorSamples } from '../libs/editorSamples';
import {
  useNospaceExecution,
  type BackendFactory,
} from '../hooks/useNospaceExecution';
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
 * Compile / Run / TestEditor / Sample のタブ構成。
 * Flavor に応じて利用可能なタブのみを表示する。
 */
export const ExecutionContainer: React.FC<ExecutionContainerProps> = ({
  backendFactory,
  components,
}) => {
  const {
    TestEditorContainer: TestEditorContainerImpl = TestEditorContainer,
    ExecutionOptions: ExecutionOptionsImpl = ExecutionOptions,
    CompileOptions: CompileOptionsImpl = CompileOptions,
    OutputPanel: OutputPanelImpl = OutputPanel,
    InputPanel: InputPanelImpl = InputPanel,
    SampleList: SampleListImpl = SampleList,
  } = components ?? {};

  const flavor = useAtomValue(flavorAtom);
  const [batchInput, setBatchInput] = useState('');
  const [operationMode, setOperationMode] = useAtom(operationModeAtom);
  const setSourceCode = useSetAtom(sourceCodeAtom);
  const [compileOutputCollapsed, setCompileOutputCollapsed] = useState(true);

  // Compile/Run: コンパイル完了後に自動実行するためのペンディング入力データ。null は待機中でないことを示す
  const pendingAutoRunRef = useRef<{ batchInput: string } | null>(null);

  const {
    isRunning,
    handleCompile,
    handleRunCompileOutput,
    handleKill,
    handleSendStdin,
    handleClearOutput,
    compileOutput,
    compileStatus,
    backendState,
    retryBackend,
  } = useNospaceExecution(backendFactory);

  const isWasm = flavor === 'wasm';
  const isWebSocket = flavor === 'websocket';

  const backendReady = backendState.kind === 'ready';

  // flavor が変わると backend が作り直されるため、旧 backend のコンパイルを待っていた自動実行を破棄する
  // （残ると、次の ws コンパイル成功時に意図しない自動実行が起きる）
  useEffect(() => {
    pendingAutoRunRef.current = null;
  }, [flavor]);

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

  // WASM flavor は test-editor 非対応のため compile に強制リダイレクト
  useEffect(() => {
    if (isWasm && operationMode === 'test-editor') {
      setOperationMode('compile');
    }
  }, [isWasm, operationMode]);

  /** サンプルをロードしてコンパイルタブへ切り替える */
  const handleLoadSample = (code: string) => {
    setSourceCode(code);
    setOperationMode('compile');
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

  const canRunCompiled =
    compileOutput !== null && compileOutput.target === 'ws';

  const statusBar = (
    <BackendStatusBar
      state={backendState}
      flavor={flavor}
      onRetry={retryBackend}
    />
  );

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
          {statusBar}
          <ExecutionControls
            isRunning={isRunning}
            disabled={!backendReady}
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
        </>
      ) : operationMode === 'run' ? (
        <>
          {/* Run タブ: コンパイル済みコードの実行 */}
          <ExecutionOptionsImpl />
          {statusBar}
          <ExecutionControls
            isRunning={isRunning}
            disabled={!backendReady}
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
      ) : null}
    </div>
  );
};
