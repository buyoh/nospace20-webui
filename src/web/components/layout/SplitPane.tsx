import React, { useState, useRef, useEffect, ReactNode } from 'react';
import './styles/SplitPane.scss';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initialLeftWidth?: number; // percentage (0-100)
  minLeftWidth?: number; // pixels
  minRightWidth?: number; // pixels
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  initialLeftWidth = 50,
  minLeftWidth = 200,
  minRightWidth = 200,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Calculate new left width percentage
      let newLeftWidth = (mouseX / containerWidth) * 100;

      // Apply min width constraints
      const minLeftPercent = (minLeftWidth / containerWidth) * 100;
      const minRightPercent = (minRightWidth / containerWidth) * 100;

      newLeftWidth = Math.max(minLeftPercent, newLeftWidth);
      newLeftWidth = Math.min(100 - minRightPercent, newLeftWidth);

      setLeftWidth(newLeftWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <div
      ref={containerRef}
      className={`split-pane ${isDragging ? 'dragging' : ''}`}
    >
      <div className="split-pane-left" style={{ width: `${leftWidth}%` }}>
        {left}
      </div>
      <div className="split-pane-divider" onMouseDown={handleMouseDown} />
      <div
        className="split-pane-right"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {right}
      </div>
    </div>
  );
};
