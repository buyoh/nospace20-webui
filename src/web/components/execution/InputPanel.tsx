import React, { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { executionOptionsAtom } from '../../stores/optionsAtom';
import { outputEntriesAtom } from '../../stores/executionAtom';
import type { OutputEntry } from '../../../interfaces/NospaceTypes';
import { Button } from '../common/Button';
import { TextInput } from '../common/TextInput';
import { Textarea } from '../common/Textarea';
import './styles/InputPanel.scss';

/** 入力パネル（バッチ/インタラクティブ入力）の Props */
interface InputPanelProps {
  isRunning: boolean;
  onSendStdin: (data: string) => void;
  batchInput?: string;
  onBatchInputChange?: (value: string) => void;
  /** true の場合、inputMode に関わらず batch UI のみ表示 */
  forceBatchMode?: boolean;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  isRunning,
  onSendStdin,
  batchInput = '',
  onBatchInputChange,
  forceBatchMode = false,
}) => {
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [interactiveInput, setInteractiveInput] = useState('');
  const setOutputEntries = useSetAtom(outputEntriesAtom);

  const handleInteractiveSend = () => {
    if (!interactiveInput.trim() || !isRunning) return;

    // Send to server
    onSendStdin(interactiveInput);

    // Add echo to output
    const entry: OutputEntry = {
      type: 'stdin-echo',
      data: `> ${interactiveInput}\n`,
      timestamp: Date.now(),
    };
    setOutputEntries((prev) => [...prev, entry]);

    // Clear input
    setInteractiveInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInteractiveSend();
    }
  };

  // WASM flavor（forceBatchMode=true）の場合は常に batch UI
  const effectiveInputMode = forceBatchMode
    ? 'batch'
    : executionOptions.inputMode;

  if (effectiveInputMode === 'interactive') {
    return (
      <div className="input-panel">
        <h3>Interactive Input</h3>
        <div className="interactive-input-group">
          <TextInput
            type="text"
            value={interactiveInput}
            onChange={(e) => setInteractiveInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type input and press Enter..."
            disabled={!isRunning}
            className="interactive-input"
          />
          <Button
            variant="primary"
            onClick={handleInteractiveSend}
            disabled={!isRunning || !interactiveInput.trim()}
            className="btn-send"
          >
            Send
          </Button>
        </div>
      </div>
    );
  }

  // Batch mode
  return (
    <div className="input-panel">
      <h3>Batch Input</h3>
      <Textarea
        value={batchInput}
        onChange={(e) => onBatchInputChange?.(e.target.value)}
        placeholder="Enter all input data here (before running)..."
        className="batch-input"
      />
    </div>
  );
};
