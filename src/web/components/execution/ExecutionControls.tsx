import React from 'react';
import './styles/ExecutionControls.scss';

/** 実行コントロール（Run/Compile/Kill ボタン）の Props */
interface ExecutionControlsProps {
  isRunning: boolean;
  onRun: () => void;
  onKill: () => void;
  /** Compile ボタンを表示するか（WASM flavor のみ） */
  onCompile?: () => void;
  supportsCompile?: boolean;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  onRun,
  onKill,
  onCompile,
  supportsCompile = false,
}) => {
  return (
    <div className="execution-controls">
      {supportsCompile && onCompile && (
        <button
          onClick={onCompile}
          disabled={isRunning}
          className="btn-compile"
        >
          Compile
        </button>
      )}
      <button onClick={onRun} disabled={isRunning} className="btn-run">
        Run
      </button>
      <button onClick={onKill} disabled={!isRunning} className="btn-kill">
        Stop
      </button>
    </div>
  );
};
