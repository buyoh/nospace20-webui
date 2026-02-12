import React from 'react';
import './styles/ExecutionControls.scss';

/** 実行コントロール（Run/Kill ボタン）の Props */
interface ExecutionControlsProps {
  isRunning: boolean;
  onRun: () => void;
  onKill: () => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  onRun,
  onKill,
}) => {
  return (
    <div className="execution-controls">
      <button onClick={onRun} disabled={isRunning} className="btn-run">
        Run
      </button>
      <button onClick={onKill} disabled={!isRunning} className="btn-kill">
        Stop
      </button>
    </div>
  );
};
