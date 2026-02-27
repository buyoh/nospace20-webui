import React, { useMemo } from 'react';
import { useAtom } from 'jotai';
import type { CompileOutput } from '../../stores/compileOutputAtom';
import {
  whitespaceDisplayModeAtom,
} from '../../stores/compileOutputAtom';
import { formatWhitespaceVisible, isWhitespaceTarget } from '../../libs/whitespaceFormatter';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Button } from '../common/Button';
import './styles/CompileOutputPanel.scss';

/** コンパイル中間出力パネルの Props */
interface CompileOutputPanelProps {
  /** コンパイル結果 */
  compileOutput: CompileOutput | null;
  /** コンパイル済み Whitespace コードを実行する。未指定時は Run ボタンを非表示 */
  onRunCompiled?: () => void;
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
 * ws / ex-ws ターゲット時は可視文字表示モード切り替えを提供する。
 * 画面幅の都合上、折りたたみ可能。
 */
export const CompileOutputPanel: React.FC<CompileOutputPanelProps> = ({
  compileOutput,
  onRunCompiled,
  isRunning,
  collapsed,
  onToggleCollapse,
}) => {
  const canRun = onRunCompiled !== undefined && compileOutput !== null && compileOutput.target === 'ws';
  const showDisplayToggle = compileOutput !== null && isWhitespaceTarget(compileOutput.target);

  const [displayMode, setDisplayMode] = useAtom(whitespaceDisplayModeAtom);

  // 表示テキストを生成（可視モード時は SP/TB/LF に変換）
  const displayText = useMemo(() => {
    if (!compileOutput) return '';
    if (showDisplayToggle && displayMode === 'visible') {
      return formatWhitespaceVisible(compileOutput.output);
    }
    return compileOutput.output;
  }, [compileOutput, displayMode, showDisplayToggle]);

  const handleSetDisplayMode = (mode: typeof displayMode) => {
    setDisplayMode(mode);
  };

  return (
    <CollapsibleSection
      title="Compiled Output"
      className="compile-output-panel"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      headerActions={
        <>
          {showDisplayToggle && (
            <div className="display-mode-toggle">
              <button
                className={`btn-mode${displayMode === 'raw' ? ' active' : ''}`}
                onClick={() => handleSetDisplayMode('raw')}
                title="通常表示（そのまま）"
              >
                Raw
              </button>
              <button
                className={`btn-mode${displayMode === 'visible' ? ' active' : ''}`}
                onClick={() => handleSetDisplayMode('visible')}
                title="可視文字表示（SP/TB/LF）"
              >
                SP TB LF
              </button>
            </div>
          )}
          {canRun && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRunCompiled}
              disabled={isRunning}
              className="btn-run-compiled"
            >
              Run
            </Button>
          )}
        </>
      }
    >
      <div className="compile-output-content">
        {compileOutput ? (
          <>
            <textarea
              className="compile-output-textarea"
              readOnly
              value={displayText}
            />
          </>
        ) : (
          <div className="compile-output-empty">No compiled output yet</div>
        )}
      </div>
    </CollapsibleSection>
  );
};
