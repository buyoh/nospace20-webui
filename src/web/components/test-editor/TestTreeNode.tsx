import React, { useState } from 'react';
import type { TestTreeNode as TestTreeNodeType } from '../../../interfaces/TestTypes';

interface TestTreeNodeProps {
  node: TestTreeNodeType;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth: number;
}

/**
 * テストツリーの1ノード（ディレクトリまたはテストケース）を描画する再帰コンポーネント
 */
export const TestTreeNode: React.FC<TestTreeNodeProps> = ({
  node,
  selectedPath,
  onSelect,
  depth,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleClick = () => {
    if (node.type === 'directory') {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(node.path);
    }
  };

  const isSelected = node.type === 'test' && node.path === selectedPath;
  const style = { paddingLeft: `${depth * 16}px` };

  return (
    <>
      <div
        className={`test-tree-node ${node.type} ${isSelected ? 'selected' : ''}`}
        style={style}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="tree-icon">{isExpanded ? '▼' : '▶'}</span>
        )}
        {node.type === 'test' && (
          <span className="tree-icon">{isSelected ? '●' : '○'}</span>
        )}
        <span className={`tree-name ${node.type === 'test' && !node.hasCheck ? 'no-check' : ''}`}>
          {node.name}
        </span>
      </div>
      {node.type === 'directory' &&
        isExpanded &&
        node.children?.map((child) => (
          <TestTreeNode
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </>
  );
};
