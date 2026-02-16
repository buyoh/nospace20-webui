import React from 'react';
import './styles/ExecutionControls.scss';

/** 実行コントロール（Run/Compile/Kill ボタン）の Props */
interface ExecutionControlsProps {
  isRunning: boolean;
  /** Run ボタンのコールバック。未指定の場合、Run ボタンは非表示 */
  onRun?: () => void;
  onKill: () => void;
  /** Compile ボタンのコールバック。未指定の場合、Compile ボタンは非表示 */
  onCompile?: () => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  onRun,
  onKill,
  onCompile,
}) => {
  return (
    <div className="execution-controls">
      {onCompile && (
        <button
          onClick={onCompile}
          disabled={isRunning}
          className="btn-compile"
        >
          Compile
        </button>
      )}
      {onRun && (
        <button onClick={onRun} disabled={isRunning} className="btn-run">
          Run
        </button>
      )}
      <button onClick={onKill} disabled={!isRunning} className="btn-kill">
        Stop
      </button>
    </div>
  );
};
