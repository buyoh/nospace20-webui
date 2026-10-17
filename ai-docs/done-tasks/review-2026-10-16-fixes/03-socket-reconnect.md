# 03. Socket 再接続・切断時の処理

再接続ごとにリスナーが重複登録される問題を解消し、切断時に実行状態を安全に復帰させる。

作成日: 2026-10-16
ステータス: 完了
元指摘: [05-socket-reconnect-handling.md](../code-review-2026-10-16/05-socket-reconnect-handling.md)
依存: [02](02-backend-lifecycle-state.md)（`backendStateAtom`）、[01](01-session-request-id.md)（requestId による終端管理）

## 設計・方針

### 現状の問題（要約）

- `NospaceSocketClient.connect` は `socket.on('connect', ...)` 内で `setupListeners` を呼ぶため、自動再接続のたびにリスナーが追加される（出力の多重表示）
- `disconnect` を購読しておらず、実行中に切断されると UI が `running` のまま固着する（サーバは切断時にセッションを kill 済み）
- 初回接続タイムアウト / `connect_error` で reject しても socket を close せず、バックグラウンドで再接続を続ける

### `NospaceSocketClient`

```ts
export interface NospaceSocketEventHandlers {
  onStdout: ...; onStderr: ...; onExecutionStatus: ...;   // 01 で requestId を追加済み
  /** 接続が切れたとき（初回接続成功後のみ） */
  onDisconnect: (reason: string) => void;
  /** 切断後に再接続したとき */
  onReconnect: () => void;
}
```

`connect(handlers, timeoutMs)` の手順:

1. socket 生成直後に**一度だけ**データ系リスナー（stdout / stderr / status）を登録する
2. `connect` リスナーは**永続リスナー 1 つ**とし、内部の `hasConnected` フラグで分岐する（`once` と併用しないことで登録順序に依存しない）
   - 初回: `hasConnected = true`、タイマー解除、resolve
   - 2 回目以降: `onReconnect()`
3. `disconnect` リスナー: `hasConnected` が true なら `onDisconnect(reason)`
4. タイムアウト・初回接続前の `connect_error` では `socket.close()` → `this.socket = null` → reject（バックグラウンド再接続を残さない）。初回接続後の `connect_error` は socket.io-client の自動再接続に任せる
5. `disconnect` の reason が `'io server disconnect'`（サーバ側からの意図的な切断。socket.io-client は自動再接続しない）の場合は自動再接続しない。`onDisconnect` に reason を渡し、上位で `backendState: error`（Retry で再生成）とする。将来サーバがレート制限等で意図的に切断した場合の再接続ループを避けるため
6. `close()` は `socket.removeAllListeners()` → `socket.close()`
7. **未接続時の送信を拒否**: socket.io-client は未接続時の emit をバッファし再接続時に送信するため、`emitRun` / `emitCompile` / `emitStdin` / `emitKill` は `socket.connected` が false なら送信せず `Error('Socket not connected')` を throw する。これにより「クライアントは結果を捨てるのにサーバでプロセスが走る」状況（04 のスロット消費）を防ぐ。`run` / `compile` の throw は 01 の「同期例外時の復帰」で `error` 表示となる。切断中の kill / stdin は対象セッションがサーバ側で kill 済みのため、`ServerExecutionBackend` 側で catch して無視する

初回接続失敗時・サーバ切断時の再試行は、02 の `retry`（backend 再生成）で行う。

### `ExecutionBackend` インタフェース拡張

```ts
/** 接続状態（connected: 再接続完了 / reconnecting: 自動再接続中 / lost: 自動再接続しない切断） */
export type ConnectionState = 'connected' | 'reconnecting' | 'lost';
/** 接続状態の変化を通知する（サーバ接続を持たない backend は呼ばない） */
onConnectionChange?(callback: (state: ConnectionState) => void): void;
```

WASM backend は実装しない（optional）。

### `ServerExecutionBackend`

- `onDisconnect`:
  1. 実行中のリクエストがあれば（`activeRequestId !== null && !activeTerminated`）、`activeTerminated = true` とし、`statusCallback('error', currentSessionId ?? '', null)` とシステムメッセージ `\n[Connection lost: <reason>]\n` を出力
  2. reason が `'io server disconnect'` なら `connectionCallback?.('lost')`、それ以外は `connectionCallback?.('reconnecting')`
- `onReconnect`: `connectionCallback?.('connected')`
- `isReady()` は従来通り `client.connected`

### `useExecutionBackend`（02 の設計に追加）

- `backend.onConnectionChange?.(...)` で `connected` → `{ kind: 'ready' }`、`reconnecting` → `{ kind: 'disconnected' }`、`lost` → `{ kind: 'error', message: 'Disconnected by server' }`（Retry ボタンで再生成）
- `cancelled` ガードは 02 と同様に適用

### コンパイル中の切断とコンパイル結果ステータス

現状 `useExecutionBackend` は `compiling` → 非 `compiling` 遷移で `compileHadErrorRef` のみを見て `success` / `error` を決めるため、切断（`error`）やサーバの `error` 終了でも構造化エラーがなければ `success` と表示される。

修正: `status === 'error' || status === 'killed'` の場合も `compileStatus = 'error'` とする。

```ts
if (prevStatusRef.current === 'compiling') {
  const failed = compileHadErrorRef.current || status === 'error' || status === 'killed';
  setCompileStatus(failed ? 'error' : 'success');
}
```

これにより Compile/Run の自動実行（`pendingAutoRunRef`）も error 扱いで解除される。

## タスクステップ・チェックリスト

1. [x] `NospaceSocketClient`: リスナー一度だけ登録、`onDisconnect` / `onReconnect`、初回失敗時 close、`close()` で全リスナー解除、未接続時の emit 拒否
2. [x] `ExecutionBackend.onConnectionChange` を追加
3. [x] `ServerExecutionBackend`: 切断時の終端処理とシステムメッセージ、接続状態通知
4. [x] `useExecutionBackend`: 接続状態を `backendStateAtom` に反映、compileStatus 判定の修正
5. [x] テスト

### テスト

`NospaceSocketClient.spec.ts` のフェイク socket は現在 `listeners[event] = handler`（1 イベント 1 ハンドラ）で上書きするため、重複登録を検出できない。**イベントごとに配列で保持する**よう変更し、`once` / `removeAllListeners` / `connect` もフェイクに追加する。

| 対象 | ケース |
|---|---|
| `NospaceSocketClient.spec` | `connect` が 2 回発火しても stdout リスナーは 1 つ（受信時ハンドラ呼び出し 1 回） |
| `NospaceSocketClient.spec` | 初回後の `disconnect` → `onDisconnect`、再 `connect` → `onReconnect` |
| `NospaceSocketClient.spec` | タイムアウト / 初回 `connect_error` で `socket.close` が呼ばれる |
| `NospaceSocketClient.spec` | 初回 `connect` では `onReconnect` が呼ばれない |
| `NospaceSocketClient.spec` | reason `'io server disconnect'` で `socket.connect` が呼ばれず、`onDisconnect` に reason が渡る |
| `NospaceSocketClient.spec` | 未接続時の `emitRun` が throw し、`socket.emit` が呼ばれない |
| `useExecutionBackend.spec` | `lost` で `backendState` が `error` になる |
| `ServerExecutionBackend.spec` | running 中の切断で status `error` とシステムメッセージが 1 回通知され、以後の旧イベントは無視 |
| `useExecutionBackend.spec` | 接続状態変化で `backendState` が `disconnected` / `ready` に切り替わる |
| `useExecutionBackend.spec` | `compiling` → `error`（構造化エラーなし）で compileStatus が `error` |

## 影響範囲

- `src/web/services/NospaceSocketClient.ts`, `ServerExecutionBackend.ts`, `ExecutionBackend.ts`
- `src/web/hooks/useExecutionBackend.ts`
- テスト: `NospaceSocketClient.spec.ts`（フェイク socket の改修含む）, `ServerExecutionBackend.spec.ts`, `useExecutionBackend.spec.tsx`
