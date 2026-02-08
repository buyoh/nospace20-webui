import React from 'react';

interface CounterDisplayProps {
  count: number;
}

export function CounterDisplay({
  count,
}: CounterDisplayProps): React.ReactNode {
  return (
    <div className="counter-display">
      <span className="counter-value">{count}</span>
    </div>
  );
}
