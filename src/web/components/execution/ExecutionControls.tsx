import React from 'react';
import { Button } from '../common/Button';
import type { CompileStatus } from '../../stores/compileOutputAtom';
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
  /** Compile/Run ボタンのコールバック。未指定の場合、Compile/Run ボタンは非表示 */
  onCompileAndRun?: () => void;
  /** 直前のコンパイル結果ステータス（Run/Stop ボタンの横に表示） */
  compileStatus?: CompileStatus;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  onRun,
  runDisabled = false,
  onKill,
  onCompile,
  onCompileAndRun,
  compileStatus,
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
      {onCompileAndRun && (
        <Button
          variant="accent"
          onClick={onCompileAndRun}
          disabled={isRunning}
          className="btn-compile-and-run"
        >
          Compile/Run
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
      {compileStatus === 'success' && (
        <span className="compile-status compile-status--success" aria-label="コンパイル成功">
          ✓ OK
        </span>
      )}
      {compileStatus === 'error' && (
        <span className="compile-status compile-status--error" aria-label="コンパイル失敗">
          ✗ Error
        </span>
      )}
    </div>
  );
};
