import React, { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { executionOptionsAtom } from '../../stores/optionsAtom';
import { outputEntriesAtom } from '../../stores/executionAtom';
import type { OutputEntry } from '../../../interfaces/NospaceTypes';
import './styles/InputPanel.scss';

/** 入力パネル（バッチ/インタラクティブ入力）の Props */
interface InputPanelProps {
  isRunning: boolean;
  onSendStdin: (data: string) => void;
  batchInput?: string;
  onBatchInputChange?: (value: string) => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  isRunning,
  onSendStdin,
  batchInput = '',
  onBatchInputChange,
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

  if (executionOptions.inputMode === 'interactive') {
    return (
      <div className="input-panel">
        <h3>Interactive Input</h3>
        <div className="interactive-input-group">
          <input
            type="text"
            value={interactiveInput}
            onChange={(e) => setInteractiveInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type input and press Enter..."
            disabled={!isRunning}
            className="interactive-input"
          />
          <button
            onClick={handleInteractiveSend}
            disabled={!isRunning || !interactiveInput.trim()}
            className="btn-send"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  // Batch mode
  return (
    <div className="input-panel">
      <h3>Batch Input</h3>
      <textarea
        value={batchInput}
        onChange={(e) => onBatchInputChange?.(e.target.value)}
        placeholder="Enter all input data here (before running)..."
        className="batch-input"
      />
    </div>
  );
};
