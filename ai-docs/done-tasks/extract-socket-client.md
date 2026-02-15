# ServerExecutionBackend からの Socket 管理の分離

## 概要

`src/web/services/ServerExecutionBackend.ts` が現在担っている Socket.IO 接続管理・イベント処理を、専用クラス `NospaceSocketClient` に分離する。

### 目的

- **単一責任の原則**: `ServerExecutionBackend` は `ExecutionBackend` インターフェースの実装に集中し、Socket.IO 通信の詳細を知らなくてよい状態にする
- **テスト容易性向上**: Socket 通信レイヤーを独立してテスト可能にする
- **再利用性**: Socket クライアントを他の用途（将来の機能追加等）で再利用しやすくする

## 現状分析

### `ServerExecutionBackend` の現在の責務

| 責務 | メソッド/フィールド | 分類 |
|------|---------------------|------|
| Socket 生成 | `init()` 内の `socketFactory()` 呼び出し | Socket 管理 |
| 接続待機・タイムアウト | `init()` 内の Promise/timeout 処理 | Socket 管理 |
| イベントリスナー登録 | `setupEventListeners()` | Socket 管理 |
| 接続状態の確認 | `isReady()` → `socket.connected` | Socket 管理 |
| Socket 切断 | `dispose()` → `socket.close()` | Socket 管理 |
| セッション ID 管理 | `currentSessionId` フィールド | ビジネスロジック |
| 実行リクエスト送信 | `run()` → `socket.emit('nospace_run', ...)` | ビジネスロジック |
| stdin 送信 | `sendStdin()` → `socket.emit('nospace_stdin', ...)` | ビジネスロジック |
| kill 送信 | `kill()` → `socket.emit('nospace_kill', ...)` | ビジネスロジック |
| stdout/stderr のコールバック変換 | `setupEventListeners()` 内 | ビジネスロジック |
| ステータス変更時のシステムメッセージ生成 | `setupEventListeners()` 内 | ビジネスロジック |

### 依存関係

- `ServerExecutionBackend` → `socket.io-client` (`io`, `Socket` 型)
- `ServerExecutionBackend` → `ExecutionBackend` インターフェース
- `useNospaceExecution` → `ServerExecutionBackend` (動的 import)
- テスト → `ServerExecutionBackend` (Fake Socket による DI)

## 設計

### 新規クラス: `NospaceSocketClient`

**ファイル**: `src/web/services/NospaceSocketClient.ts`

Socket.IO の接続管理・低レベルイベント処理を担当するクラス。

```typescript
// src/web/services/NospaceSocketClient.ts

import { Socket } from 'socket.io-client';
import type {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
  RunOptions,
} from '../../interfaces/NospaceTypes';

type AppSocket = Socket<
  NospaceServerToClientEvents,
  NospaceClientToServerEvents
>;

/** Socket を生成するファクトリ関数 */
export interface SocketFactory {
  (): AppSocket;
}

/** サーバーから受信するイベントのコールバック */
export interface NospaceSocketEventHandlers {
  onStdout: (payload: { sessionId: string; data: string }) => void;
  onStderr: (payload: { sessionId: string; data: string }) => void;
  onExecutionStatus: (payload: {
    sessionId: string;
    status: string;
    exitCode?: number | null;
  }) => void;
}

/**
 * Socket.IO 接続の管理と nospace プロトコルのイベント送受信を担当するクラス。
 * 接続のライフサイクル管理および低レベルなイベント送受信のみを行い、
 * ビジネスロジック（OutputEntry 変換、システムメッセージ生成等）は含まない。
 */
export class NospaceSocketClient {
  private socket: AppSocket | null = null;

  constructor(private socketFactory: SocketFactory) {}

  /**
   * Socket.IO 接続を確立し、イベントリスナーを登録する。
   * @param handlers 受信イベントのコールバック
   * @param timeoutMs 接続タイムアウト（デフォルト: 10000ms）
   */
  async connect(
    handlers: NospaceSocketEventHandlers,
    timeoutMs = 10000,
  ): Promise<void> {
    const socket = this.socketFactory();
    if (!socket) {
      throw new Error('Failed to create Socket client');
    }
    this.socket = socket;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket.IO connection timeout'));
      }, timeoutMs);

      socket.on('connect', () => {
        clearTimeout(timeout);
        this.setupListeners(handlers);
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /** 接続済みかどうか */
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** 実行リクエストを送信 */
  emitRun(code: string, options: RunOptions, stdinData?: string): void {
    this.requireSocket().emit('nospace_run', { code, options, stdinData });
  }

  /** stdin データを送信 */
  emitStdin(sessionId: string, data: string): void {
    this.requireSocket().emit('nospace_stdin', { sessionId, data });
  }

  /** kill リクエストを送信 */
  emitKill(sessionId: string): void {
    this.requireSocket().emit('nospace_kill', { sessionId });
  }

  /** 接続を切断しリソースを解放 */
  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private setupListeners(handlers: NospaceSocketEventHandlers): void {
    const socket = this.requireSocket();
    socket.on('nospace_stdout', handlers.onStdout);
    socket.on('nospace_stderr', handlers.onStderr);
    socket.on('nospace_execution_status', handlers.onExecutionStatus);
  }

  private requireSocket(): AppSocket {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    return this.socket;
  }
}
```

### 変更後の `ServerExecutionBackend`

`NospaceSocketClient` を利用するように書き換える。ビジネスロジック（`OutputEntry` 変換、システムメッセージ生成、セッション管理）のみを担当する。

```typescript
// src/web/services/ServerExecutionBackend.ts

import { io } from 'socket.io-client';
import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';
import type {
  ExecutionBackend,
  ExecutionBackendCapabilities,
} from './ExecutionBackend';
import {
  NospaceSocketClient,
  type SocketFactory,
} from './NospaceSocketClient';

const defaultSocketFactory: SocketFactory = () => io();

export class ServerExecutionBackend implements ExecutionBackend {
  readonly flavor = 'server' as const;

  private client: NospaceSocketClient;
  private currentSessionId: string | null = null;
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback:
    | ((
        status: ExecutionStatus,
        sessionId: string,
        exitCode?: number | null,
      ) => void)
    | null = null;

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: true,
    supportsCompile: false,
    supportsIgnoreDebug: true,
    supportsLanguageSubsetForRun: true,
    requiresServer: true,
  };

  constructor(socketFactory: SocketFactory = defaultSocketFactory) {
    this.client = new NospaceSocketClient(socketFactory);
  }

  async init(): Promise<void> {
    await this.client.connect({
      onStdout: (payload) => {
        this.outputCallback?.({
          type: 'stdout',
          data: payload.data,
          timestamp: Date.now(),
        });
      },
      onStderr: (payload) => {
        this.outputCallback?.({
          type: 'stderr',
          data: payload.data,
          timestamp: Date.now(),
        });
      },
      onExecutionStatus: (payload) => {
        this.currentSessionId = payload.sessionId;
        this.statusCallback?.(
          payload.status as ExecutionStatus,
          payload.sessionId,
          payload.exitCode,
        );
        this.emitSystemMessage(payload.status as ExecutionStatus, payload.exitCode);
      },
    });
  }

  isReady(): boolean {
    return this.client.connected;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    this.client.emitRun(code, options, stdinData);
  }

  compile(_code: string, _options: CompileOptions): void {
    throw new Error('Compile not supported in server flavor');
  }

  sendStdin(data: string): void {
    if (!this.currentSessionId) return;
    this.client.emitStdin(this.currentSessionId, data);
  }

  kill(): void {
    if (!this.currentSessionId) return;
    this.client.emitKill(this.currentSessionId);
  }

  dispose(): void {
    this.client.close();
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null,
    ) => void,
  ): void {
    this.statusCallback = callback;
  }

  /** ステータス変更時にシステムメッセージを出力する */
  private emitSystemMessage(
    status: ExecutionStatus,
    exitCode?: number | null,
  ): void {
    let systemMessage: string | null = null;
    if (status === 'running') {
      systemMessage = `[Process started: ${this.currentSessionId}]\n`;
    } else if (status === 'finished') {
      systemMessage = `\n[Process exited with code: ${exitCode ?? 'unknown'}]\n`;
    } else if (status === 'killed') {
      systemMessage = `\n[Process killed]\n`;
    } else if (status === 'error') {
      systemMessage = `\n[Process error]\n`;
    }
    if (systemMessage) {
      this.outputCallback?.({
        type: 'system',
        data: systemMessage,
        timestamp: Date.now(),
      });
    }
  }
}
```

## 影響範囲

### 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/web/services/NospaceSocketClient.ts` | **新規作成** - Socket 管理クラス |
| `src/web/services/ServerExecutionBackend.ts` | `NospaceSocketClient` を利用するようリファクタリング |
| `src/tests/web/ServerExecutionBackend.spec.ts` | テスト修正（Fake Socket の注入先が変わる） |
| `src/tests/web/NospaceSocketClient.spec.ts` | **新規作成** - `NospaceSocketClient` 用のユニットテスト |

### 変更しないファイル

| ファイル | 理由 |
|----------|------|
| `src/web/services/ExecutionBackend.ts` | インターフェースは変更なし |
| `src/web/hooks/useNospaceExecution.ts` | `ServerExecutionBackend` の公開 API は変化しないため影響なし |
| `src/interfaces/NospaceTypes.ts` | 型定義は変更なし |
| `src/web/services/WasmExecutionBackend.ts` | 無関係 |

### 公開インターフェースへの影響

- `ServerExecutionBackend` のコンストラクタ引数 `SocketFactory` の型は `NospaceSocketClient` モジュールから re-export する。既存の呼び出し元（テスト）は型の import 先が変わるが、シグネチャは同一。
- `ExecutionBackend` インターフェースに変更なし。`useNospaceExecution` からの利用方法も変化しない。

## テスト方針

### `NospaceSocketClient` のユニットテスト

- `connect()` で Socket 生成・イベント登録が正しく行われること
- `connect()` タイムアウト時に reject すること
- `connect_error` 時に reject すること
- `emitRun` / `emitStdin` / `emitKill` が正しいイベント名・ペイロードで `socket.emit` を呼ぶこと
- `close()` で `socket.close()` が呼ばれること
- 接続前の操作で適切なエラーが発生すること

### `ServerExecutionBackend` のテスト修正

- Fake Socket の注入は引き続き `SocketFactory` 経由で行う（変更なし）
- `NospaceSocketClient` の内部動作は `NospaceSocketClient` のテストに委ね、`ServerExecutionBackend` のテストはビジネスロジック（Output 変換、システムメッセージ生成等）に注目する
- 既存テストの大部分は Fake Socket 経由で動作するため、テストの構造は大きく変わらない

## 実装手順

1. `NospaceSocketClient` クラスを新規作成
2. `NospaceSocketClient` のユニットテストを作成
3. `ServerExecutionBackend` を `NospaceSocketClient` を使うようにリファクタリング
4. `ServerExecutionBackend` のテストを修正・動作確認
5. 全テスト・ビルドの通過を確認
