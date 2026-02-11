# Socket.IO 通信プロトコル

## 概要

クライアント・サーバー間の通信は Socket.IO で行う。
既存の Counter アプリケーションと同じパターンを踏襲し、型安全な通信を実現する。

現時点ではインタプリタ（実行）のみを対象とし、コンパイル関連のイベントは定義しない。

## 型定義

```typescript
// src/interfaces/NospaceTypes.ts に追加

// --- Socket.IO イベント型 ---

export interface NospaceClientToServerEvents {
  /** 実行要求 */
  nospace_run: (payload: {
    code: string;
    options: RunOptions;
    stdinData?: string;  // batch モード時の一括入力データ
  }) => void;

  /** 標準入力送信（実行中のプロセスへ、interactive モード） */
  nospace_stdin: (payload: {
    sessionId: string;
    data: string;
  }) => void;

  /** 実行中プロセスの停止要求 */
  nospace_kill: (payload: {
    sessionId: string;
  }) => void;
}

export interface NospaceServerToClientEvents {
  /** 標準出力データ（ストリーミング） */
  nospace_stdout: (payload: {
    sessionId: string;
    data: string;
  }) => void;

  /** 標準エラー出力データ（ストリーミング） */
  nospace_stderr: (payload: {
    sessionId: string;
    data: string;
  }) => void;

  /** 実行状態変更 */
  nospace_execution_status: (payload: {
    sessionId: string;
    status: ExecutionStatus;
    exitCode?: number | null;
  }) => void;
}
```

## イベントフロー

### 実行フロー（batch stdin）

```
Client                              Server
  |                                    |
  |-- nospace_run(code, opts) ------->|
  |                                    |-- spawn nospace20 run
  |<-- nospace_execution_status ------|  (status: 'running', sessionId)
  |                                    |
  |<-- nospace_stdout(data) ----------|  (streaming)
  |<-- nospace_stderr(data) ----------|  (streaming)
  |                                    |
  |                                    |-- process exits
  |<-- nospace_execution_status ------|  (status: 'finished', exitCode)
  |                                    |
```

### 実行フロー（interactive stdin）

```
Client                              Server
  |                                    |
  |-- nospace_run(code, opts) ------->|
  |                                    |-- spawn nospace20 run
  |<-- nospace_execution_status ------|  (status: 'running', sessionId)
  |                                    |
  |<-- nospace_stdout(data) ----------|  (プロンプト等)
  |                                    |
  |-- nospace_stdin(sessionId, data)->|  (ユーザー入力)
  |                                    |-- write to process stdin
  |                                    |
  |<-- nospace_stdout(data) ----------|  (応答)
  |                                    |
  |  ... (繰り返し) ...                |
  |                                    |
  |                                    |-- process exits
  |<-- nospace_execution_status ------|  (status: 'finished', exitCode)
  |                                    |
```

### Kill フロー

```
Client                              Server
  |                                    |
  |-- nospace_kill(sessionId) ------->|
  |                                    |-- SIGTERM to process
  |<-- nospace_execution_status ------|  (status: 'killed')
  |                                    |
```

## ExpressSocketIO.ts の変更

既存の Counter イベントと **共存** させる形で nospace イベントを追加する。
（Counter は開発中のリファレンスとして残しておいても良いが、最終的には削除）

```typescript
// Socket.IO の型パラメータを更新
type CombinedClientToServerEvents =
  ClientToServerEvents & NospaceClientToServerEvents;

type CombinedServerToClientEvents =
  ServerToClientEvents & NospaceServerToClientEvents;
```

## 接続管理

- 各 Socket 接続に対して 1 つの NospaceSession を保持
- `connection` イベント時にセッション管理を初期化
- `disconnect` イベント時に実行中プロセスを kill

## エラーイベント

エラーは `nospace_execution_status` の `status: 'error'` で通知する。
追加情報が必要な場合は stderr で送信。

## バッファリング

- stdout/stderr のストリーミングデータは、短い間隔（例: 50ms）でバッファリングしてまとめて送信
- 1 イベントあたりの最大データサイズ: 64KB
- これにより Socket.IO のオーバーヘッドを軽減
