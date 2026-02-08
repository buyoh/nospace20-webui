import React from 'react';

interface CounterButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function CounterButton({
  onClick,
  children,
  variant = 'primary',
}: CounterButtonProps): React.ReactNode {
  return (
    <button
      className={`counter-button counter-button--${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
