import React from 'react';
import { Button } from '../common/Button';
import './styles/ExecutionControls.scss';

/** 実行コントロール（Run/Compile/Kill ボタン）の Props */
interface ExecutionControlsProps {
  isRunning: boolean;
  /** Run ボタンのコールバック。未指定の場合、Run ボタンは非表示 */
  onRun?: () => void;
  /** Run ボタンを追加で無効化するフラグ（isRunning に加えて） */
  runDisabled?: boolean;
  onKill: () => void;
  /** Compile ボタンのコールバック。未指定の場合、Compile ボタンは非表示 */
  onCompile?: () => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  onRun,
  runDisabled = false,
  onKill,
  onCompile,
}) => {
  return (
    <div className="execution-controls">
      {onCompile && (
        <Button
          variant="accent"
          onClick={onCompile}
          disabled={isRunning}
          className="btn-compile"
        >
          Compile
        </Button>
      )}
      {onRun && (
        <Button
          variant="primary"
          onClick={onRun}
          disabled={isRunning || runDisabled}
          className="btn-run"
        >
          Run
        </Button>
      )}
      <Button
        variant="danger"
        onClick={onKill}
        disabled={!isRunning}
        className="btn-kill"
      >
        Stop
      </Button>
    </div>
  );
};
