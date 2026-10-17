import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BackendStatusBar } from '../../web/components/execution/BackendStatusBar';
import '@testing-library/jest-dom';

describe('BackendStatusBar', () => {
  it('ready のときは何も表示しない', () => {
    const { container } = render(
      <BackendStatusBar
        state={{ kind: 'ready' }}
        flavor="wasm"
        onRetry={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('初期化中は flavor に応じたメッセージを表示する', () => {
    const { rerender } = render(
      <BackendStatusBar
        state={{ kind: 'initializing' }}
        flavor="wasm"
        onRetry={jest.fn()}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading WASM');

    rerender(
      <BackendStatusBar
        state={{ kind: 'initializing' }}
        flavor="websocket"
        onRetry={jest.fn()}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Connecting to server'
    );
  });

  it('切断中は再接続中のメッセージを表示する', () => {
    render(
      <BackendStatusBar
        state={{ kind: 'disconnected' }}
        flavor="websocket"
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
  });

  it('エラー時はメッセージと Retry ボタンを表示し、押すと onRetry が呼ばれる', () => {
    const onRetry = jest.fn();
    render(
      <BackendStatusBar
        state={{ kind: 'error', message: 'WASM fetch failed' }}
        flavor="wasm"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('WASM fetch failed');
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
