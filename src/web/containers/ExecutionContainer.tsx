import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../stores/optionsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { CompileOptions } from '../components/execution/CompileOptions';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { useNospaceExecution } from '../hooks/useNospaceExecution';
import './styles/ExecutionContainer.scss';

/**
 * 実行パネル全体を統括するコンテナ。
 * Flavor に応じて利用可能な機能のみを表示する。
 */
export const ExecutionContainer: React.FC = () => {
  const flavor = useAtomValue(flavorAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [batchInput, setBatchInput] = useState('');
  const {
    isRunning,
    handleRun,
    handleCompile,
    handleKill,
    handleSendStdin,
    handleClearOutput,
  } = useNospaceExecution();

  const isWasm = flavor === 'wasm';
  const supportsCompile = isWasm;
  const supportsInteractiveStdin = !isWasm;

  const handleRunWithInput = () => {
    // WASM flavor では常に batch、Server flavor では executionOptions.inputMode に従う
    const inputMode = isWasm ? 'batch' : executionOptions.inputMode;
    handleRun(inputMode === 'batch' ? batchInput : undefined);
  };

  return (
    <div className="execution-container">
      <ExecutionOptions />
      {/* CompileOptions は WASM flavor でのみ表示 */}
      {supportsCompile && <CompileOptions />}
      <ExecutionControls
        isRunning={isRunning}
        onRun={handleRunWithInput}
        onKill={handleKill}
        onCompile={handleCompile}
        supportsCompile={supportsCompile}
      />
      <OutputPanel onClear={handleClearOutput} />
      {/* InputPanel:
          - WASM: batch input のみ表示
          - Server: executionOptions.inputMode に応じて batch/interactive を表示 */}
      <InputPanel
        isRunning={isRunning}
        onSendStdin={handleSendStdin}
        batchInput={batchInput}
        onBatchInputChange={setBatchInput}
        forceBatchMode={isWasm}
      />
    </div>
  );
};
