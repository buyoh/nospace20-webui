import React, { useState, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../stores/optionsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import { operationModeAtom } from '../stores/testEditorAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { CompileOptions } from '../components/execution/CompileOptions';
import { CompileOutputPanel } from '../components/execution/CompileOutputPanel';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { useNospaceExecution, type BackendFactory } from '../hooks/useNospaceExecution';
import { TestEditorContainer } from './TestEditorContainer';
import './styles/ExecutionContainer.scss';

/** ExecutionContainer の Props */
interface ExecutionContainerProps {
  /** テスト用バックエンドファクトリ（依存性注入） */
  backendFactory?: BackendFactory;
}

/**
 * 実行パネル全体を統括するコンテナ。
 * Compile / Run / Run(Direct) / TestEditor の4タブ構成。
 * Flavor に応じて利用可能なタブのみを表示する。
 */
export const ExecutionContainer: React.FC<ExecutionContainerProps> = ({ backendFactory }) => {
  const flavor = useAtomValue(flavorAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [batchInput, setBatchInput] = useState('');
  const [operationMode, setOperationMode] = useAtom(operationModeAtom);
  const [compileOutputCollapsed, setCompileOutputCollapsed] = useState(true);

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

  // WASM flavor は run-direct / test-editor 非対応のため compile に強制リダイレクト
  useEffect(() => {
    if (isWasm && (operationMode === 'run-direct' || operationMode === 'test-editor')) {
      setOperationMode('compile');
    }
  }, [isWasm, operationMode]);

  const handleRunWithInput = () => {
    const inputMode = isWasm ? 'batch' : executionOptions.inputMode;
    handleRun(inputMode === 'batch' ? batchInput : undefined);
  };

  const handleRunCompiled = () => {
    if (compileOutput?.target === 'ws') {
      handleRunCompileOutput(compileOutput.output, batchInput);
    }
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
      </div>

      {operationMode === 'test-editor' ? (
        <TestEditorContainer />
      ) : operationMode === 'compile' ? (
        <>
          {/* Compile タブ: コンパイルのみ */}
          <CompileOptions />
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
          <OutputPanel onClear={handleClearOutput} />
        </>
      ) : operationMode === 'run' ? (
        <>
          {/* Run タブ: コンパイル済みコードの実行 */}
          <ExecutionOptions />
          <ExecutionControls
            isRunning={isRunning}
            onRun={handleRunCompiled}
            runDisabled={!canRunCompiled}
            onKill={handleKill}
          />
          <OutputPanel onClear={handleClearOutput} />
          <InputPanel
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
          <ExecutionOptions />
          <ExecutionControls
            isRunning={isRunning}
            onRun={handleRunWithInput}
            onKill={handleKill}
          />
          <OutputPanel onClear={handleClearOutput} />
          <InputPanel
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
