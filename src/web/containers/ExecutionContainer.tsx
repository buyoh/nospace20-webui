import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../stores/optionsAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { useNospaceExecution } from '../hooks/useNospaceExecution';
import './styles/ExecutionContainer.scss';

export const ExecutionContainer: React.FC = () => {
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [batchInput, setBatchInput] = useState('');
  const { isRunning, handleRun, handleKill, handleSendStdin, handleClearOutput } =
    useNospaceExecution();

  const handleRunWithInput = () => {
    handleRun(executionOptions.inputMode === 'batch' ? batchInput : undefined);
  };

  return (
    <div className="execution-container">
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
      />
    </div>
  );
};
