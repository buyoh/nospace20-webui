import React, { useState } from 'react';
import './styles/CollapsibleSection.scss';

/** CollapsibleSection の Props */
interface CollapsibleSectionProps {
  /** セクションタイトル */
  title: string;
  /** ルート要素に付与する追加クラス */
  className?: string;
  /** 初期折りたたみ状態（非制御モード向け。デフォルト: false） */
  defaultCollapsed?: boolean;
  /** 折りたたみ状態（制御モード）。指定時は defaultCollapsed は無視 */
  collapsed?: boolean;
  /** 折りたたみトグル時コールバック（制御モード） */
  onToggleCollapse?: () => void;
  /** ヘッダー右側に表示するアクション要素（ボタン等） */
  headerActions?: React.ReactNode;
  /** セクション本体 */
  children: React.ReactNode;
}

/**
 * 汎用折りたたみセクションコンポーネント。
 * - 非制御モード: collapsed / onToggleCollapse を省略すると内部 useState で状態管理。
 * - 制御モード: collapsed / onToggleCollapse を指定すると外部で状態管理。
 * - headerActions で右側ボタン等をスロットとして受け取る。
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  className,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggleCollapse,
  headerActions,
  children,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  const isControlled = controlledCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const toggle = () => {
    if (isControlled) {
      onToggleCollapse?.();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <div
      className={`collapsible-section${className ? ` ${className}` : ''}${isCollapsed ? ' collapsed' : ''}`}
    >
      <div className="collapsible-header">
        <button
          className="collapsible-toggle"
          onClick={toggle}
          aria-expanded={!isCollapsed}
        >
          <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          <h3>{title}</h3>
        </button>
        {headerActions && (
          <div className="collapsible-actions">{headerActions}</div>
        )}
      </div>
      {!isCollapsed && (
        <div className="collapsible-body">{children}</div>
      )}
    </div>
  );
};
