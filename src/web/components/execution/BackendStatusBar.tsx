import React from 'react';
import type { BackendState } from '../../stores/executionAtom';
import type { Flavor } from '../../stores/flavorAtom';
import { Button } from '../common/Button';
import './styles/BackendStatusBar.scss';

/** 実行バックエンドの状態表示（初期化中・切断・失敗）の Props */
interface BackendStatusBarProps {
  state: BackendState;
  flavor: Flavor;
  /** 初期化失敗時の Retry ボタンのコールバック */
  onRetry: () => void;
}

/**
 * 実行バックエンドが利用できない理由を表示するバー。
 * 準備完了（ready）のときは何も表示しない。
 */
export const BackendStatusBar: React.FC<BackendStatusBarProps> = ({
  state,
  flavor,
  onRetry,
}) => {
  if (state.kind === 'ready') return null;

  if (state.kind === 'initializing') {
    return (
      <div className="backend-status-bar" role="status">
        {flavor === 'wasm' ? 'Loading WASM…' : 'Connecting to server…'}
      </div>
    );
  }

  if (state.kind === 'disconnected') {
    return (
      <div className="backend-status-bar" role="status">
        Connection lost. Reconnecting…
      </div>
    );
  }

  return (
    <div className="backend-status-bar backend-status-bar--error" role="alert">
      <span className="backend-status-message">{state.message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
};
