# 05. Socket 再接続時のリスナー重複登録と切断処理の欠如

- 重要度: **high**
- 対象: `src/web/services/NospaceSocketClient.ts`, `src/web/services/ServerExecutionBackend.ts`

## 問題点

`NospaceSocketClient.ts:57-72` で `socket.on('connect', ...)` の中から `setupListeners` を呼んでいる。
socket.io-client は既定で自動再接続し、再接続のたびに `connect` が発火するため、`nospace_stdout` / `nospace_stderr` / `nospace_execution_status` のリスナーが**再接続ごとに追加登録**される。
また `disconnect` を一切購読していない。

失敗シナリオ:

- 実行中にサーバ再起動・ネットワーク瞬断 → サーバは `handleDisconnect` でセッションを kill するが、クライアントは `executionStatus='running'` のまま。Run/Compile ボタンは無効のまま、Stop は存在しないセッションに `nospace_kill` を送るだけで、リロードまで操作不能
- 再接続後の実行で出力が 2 重・3 重に表示される
- 初回接続タイムアウト（`:58-60`）で promise は reject するが socket を close しないため、バックグラウンドで再接続が続き、接続時に暗黙にリスナーが登録される（UI には何も表示されない）

## 違反しているルール・原則

- フェイルセーフ設計（切断時に安全な状態へ戻す）
- イベントリスナーのライフサイクル管理

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | ハンドラ登録を `connect` の外で一度だけ行う。`once('connect')` で resolve、タイムアウト/失敗時は `socket.close()` | `NospaceSocketClient` のみ。既存 spec の前提見直し |
| 2 | `NospaceSocketEventHandlers` に `onDisconnect` / `onReconnect` を追加し、`ServerExecutionBackend` で `statusCallback('error')` とシステムメッセージを出す | インタフェース変更、`ServerExecutionBackend`, `useExecutionBackend`, テストスタブ |
| 3 | 接続状態 atom（例: `backendConnectionAtom`）を設けて Header 等に表示 | UI 追加のみ |

推奨: 1 + 2。テスト: 再接続（connect 複数回発火）でリスナーが重複しないこと、disconnect で status が復帰することを追加。
