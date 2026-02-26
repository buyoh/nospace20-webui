import React from 'react';
import type { CompileOutput } from '../../stores/compileOutputAtom';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Button } from '../common/Button';
import './styles/CompileOutputPanel.scss';

/** コンパイル中間出力パネルの Props */
interface CompileOutputPanelProps {
  /** コンパイル結果 */
  compileOutput: CompileOutput | null;
  /** コンパイル済み Whitespace コードを実行する */
  onRunCompiled: () => void;
  /** 実行中かどうか */
  isRunning: boolean;
  /** パネルが折りたたまれているかどうか */
  collapsed: boolean;
  /** パネルの開閉を切り替える */
  onToggleCollapse: () => void;
}

/**
 * コンパイル中間出力パネル。
 * コンパイル結果を表示し、Whitespace ターゲットの場合は実行ボタンを提供する。
 * 画面幅の都合上、折りたたみ可能。
 */
export const CompileOutputPanel: React.FC<CompileOutputPanelProps> = ({
  compileOutput,
  onRunCompiled,
  isRunning,
  collapsed,
  onToggleCollapse,
}) => {
  const canRun = compileOutput !== null && compileOutput.target === 'ws';

  return (
    <CollapsibleSection
      title="Compiled Output"
      className="compile-output-panel"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      headerActions={
        canRun && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRunCompiled}
            disabled={isRunning}
            className="btn-run-compiled"
          >
            Run
          </Button>
        )
      }
    >
      <div className="compile-output-content">
        {compileOutput ? (
          <textarea
            className="compile-output-textarea"
            readOnly
            value={compileOutput.output}
          />
        ) : (
          <div className="compile-output-empty">No compiled output yet</div>
        )}
      </div>
    </CollapsibleSection>
  );
};
