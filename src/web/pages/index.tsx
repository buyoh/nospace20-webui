import React from 'react';
import { CounterContainer } from '../containers/CounterContainer';

export default function IndexPage(): React.ReactNode {
  return (
    <div className="app">
      <header className="app-header">
        <h1>カウンターアプリ</h1>
      </header>
      <main className="app-main">
        <CounterContainer />
      </main>
      <footer className="app-footer">
        <p>Powered by React + Jotai + WebSocket</p>
      </footer>
    </div>
  );
}
