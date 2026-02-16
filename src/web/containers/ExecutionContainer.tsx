import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../stores/optionsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { CompileOptions } from '../components/execution/CompileOptions';
import { CompileOutputPanel } from '../components/execution/CompileOutputPanel';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { useNospaceExecution } from '../hooks/useNospaceExecution';
import { TestEditorContainer } from './TestEditorContainer';
import './styles/ExecutionContainer.scss';

type OperationMode = 'execution' | 'compile' | 'test-editor';

/**
 * 実行パネル全体を統括するコンテナ。
 * Execution mode と Compile mode を切り替え可能。
 * Flavor に応じて利用可能な機能のみを表示する。
 */
export const ExecutionContainer: React.FC = () => {
  const flavor = useAtomValue(flavorAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [batchInput, setBatchInput] = useState('');
  const [operationMode, setOperationMode] = useState<OperationMode>('execution');
  const [compileOutputCollapsed, setCompileOutputCollapsed] = useState(false);

  const {
    isRunning,
    handleRun,
    handleCompile,
    handleRunCompileOutput,
    handleKill,
    handleSendStdin,
    handleClearOutput,
    compileOutput,
  } = useNospaceExecution();

  const isWasm = flavor === 'wasm';
  const isWebSocket = flavor === 'websocket';
  const supportsCompileMode = isWasm;
  const supportsTestEditor = isWebSocket;
  const showModeTabs = supportsCompileMode || supportsTestEditor;

  // Server flavor ではコンパイルモード非対応のため、実行モードに強制
  useEffect(() => {
    if (!supportsCompileMode && operationMode === 'compile') {
      setOperationMode('execution');
    }
    if (!supportsTestEditor && operationMode === 'test-editor') {
      setOperationMode('execution');
    }
  }, [supportsCompileMode, supportsTestEditor]);

  const handleRunWithInput = () => {
    const inputMode = isWasm ? 'batch' : executionOptions.inputMode;
    handleRun(inputMode === 'batch' ? batchInput : undefined);
  };

  const handleRunCompiled = () => {
  const isTestEditorMode = operationMode === 'test-editor';

  return (
    <div className="execution-container">
      {/* モード切り替えタブ（複数モード対応の場合のみ表示） */}
      {showModeTabs && (
        <div className="operation-mode-tabs">
          <button
            className={`mode-tab ${operationMode === 'execution' ? 'active' : ''}`}
            onClick={() => setOperationMode('execution')}
          >
            Execution
          </button>
          {supportsCompileMode && (
            <button
              className={`mode-tab ${isCompileMode ? 'active' : ''}`}
              onClick={() => setOperationMode('compile')}
            >
              Compile
            </button>
          )}
          {supportsTestEditor && (
            <button
              className={`mode-tab ${isTestEditorMode ? 'active' : ''}`}
              onClick={() => setOperationMode('test-editor')}
            >
              Test Editor
            </button>
          )}
        </div>
      )}

      {isTestEditorMode ? (
        <TestEditorContainer />
      ) :    >
            Compile
          </button>
        </div>
      )}

      {isCompileMode ? (
        <>
          {/* Compile mode */}
          <CompileOptions />
          <ExecutionControls
            isRunning={isRunning}
            onCompile={handleCompile}
            onKill={handleKill}
          />
          <CompileOutputPanel
            compileOutput={compileOutput}
            onRunCompiled={handleRunCompiled}
            isRunning={isRunning}
            collapsed={compileOutputCollapsed}
            onToggleCollapse={() => setCompileOutputCollapsed((prev) => !prev)}
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
          {/* Execution mode */}
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
