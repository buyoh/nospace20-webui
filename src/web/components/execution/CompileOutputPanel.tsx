import React, { useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import type { CompileOutput } from '../../stores/compileOutputAtom';
import {
  whitespaceDisplayModeAtom,
  compileOutputPageAtom,
  compileOutputPageSizeAtom,
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
 * ws / ex-ws ターゲット時は可視文字表示モード切り替えとページネーションを提供する。
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
  const [currentPage, setCurrentPage] = useAtom(compileOutputPageAtom);
  const pageSize = useAtomValue(compileOutputPageSizeAtom);

  // 表示テキストを生成（可視モード時は SP/TB/LF に変換）
  const displayText = useMemo(() => {
    if (!compileOutput) return '';
    if (showDisplayToggle && displayMode === 'visible') {
      return formatWhitespaceVisible(compileOutput.output);
    }
    return compileOutput.output;
  }, [compileOutput, displayMode, showDisplayToggle]);

  // 行分割・ページネーション計算
  const lines = useMemo(() => displayText.split('\n'), [displayText]);
  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const showPagination = totalPages > 1;

  // 現在ページの行を抽出
  const pageLines = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return lines.slice(start, end);
  }, [lines, currentPage, pageSize]);

  const handleSetDisplayMode = (mode: typeof displayMode) => {
    setDisplayMode(mode);
    setCurrentPage(0); // 表示モード切り替え時はページを先頭にリセット
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
              value={pageLines.join('\n')}
            />
            {showPagination && (
              <div className="compile-output-pagination">
                <button
                  className="btn-page"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  aria-label="先頭ページ"
                >
                  &#x226A;
                </button>
                <button
                  className="btn-page"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  aria-label="前のページ"
                >
                  &lt;
                </button>
                <span className="page-info">
                  {currentPage + 1} / {totalPages}
                  <span className="line-info">({lines.length} lines)</span>
                </span>
                <button
                  className="btn-page"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  aria-label="次のページ"
                >
                  &gt;
                </button>
                <button
                  className="btn-page"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                  aria-label="末尾ページ"
                >
                  &#x226B;
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="compile-output-empty">No compiled output yet</div>
        )}
      </div>
    </CollapsibleSection>
  );
};
