import React from 'react';
import { useCounter } from '../hooks/useCounter';
import { CounterDisplay } from '../components/CounterDisplay';
import { CounterButton } from '../components/CounterButton';

export function CounterContainer(): React.ReactNode {
  const {
    count,
    increment,
    decrement,
    reset,
    connectionStatus,
    connectionError,
  } = useCounter();

  const statusIndicator = {
    connected: '🟢 接続中',
    disconnected: '🔴 未接続',
    error: '🔴 エラー',
  }[connectionStatus];

  return (
    <div className="counter-container">
      <h2>共有カウンター</h2>
      <p className="connection-status">
        {statusIndicator}
        {connectionError && (
          <span className="error-message">: {connectionError}</span>
        )}
      </p>
      <CounterDisplay count={count} />
      <div className="counter-buttons">
        <CounterButton onClick={decrement} variant="secondary">
          -1
        </CounterButton>
        <CounterButton onClick={increment} variant="primary">
          +1
        </CounterButton>
        <CounterButton onClick={reset} variant="danger">
          リセット
        </CounterButton>
      </div>
      <p className="counter-info">
        このカウンターはサーバーで管理され、すべてのクライアントで共有されます。
      </p>
    </div>
  );
}
