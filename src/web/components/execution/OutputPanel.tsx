import React, { useRef, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { outputEntriesAtom } from '../../stores/executionAtom';
import './styles/OutputPanel.scss';

interface OutputPanelProps {
  onClear: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ onClear }) => {
  const outputEntries = useAtomValue(outputEntriesAtom);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [outputEntries]);

  return (
    <div className="output-panel">
      <div className="output-panel-header">
        <h3>Output</h3>
        <button onClick={onClear} className="btn-clear">
          Clear
        </button>
      </div>
      <div ref={containerRef} className="output-panel-content">
        {outputEntries.length === 0 ? (
          <div className="output-empty">No output yet</div>
        ) : (
          outputEntries.map((entry, index) => (
            <div key={index} className={`output-entry output-${entry.type}`}>
              {entry.data}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
