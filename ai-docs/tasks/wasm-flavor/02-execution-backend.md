# ExecutionBackend 抽象化と実装

## 概要

Server flavor と WASM flavor を切り替え可能にするため、実行バックエンドを抽象化する。
既存の `useNospaceExecution` + `useNospaceSocket` の Socket.IO 直接依存を解消し、
`ExecutionBackend` インターフェースを介して実行を制御する。

## ExecutionBackend インターフェース

```typescript
// src/web/services/ExecutionBackend.ts

import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';

/**
 * 実行バックエンドの抽象インターフェース。
 * Server flavor と WASM flavor で共通のAPIを提供する。
 */
export interface ExecutionBackend {
  /** バックエンド種別 */
  readonly flavor: 'server' | 'wasm';

  /**
   * バックエンドを初期化する。
   * Server: Socket.IO 接続を確立
   * WASM: WASM モジュールをロード
   */
  init(): Promise<void>;

  /**
   * 接続/初期化状態
   */
  isReady(): boolean;

  /**
   * ソースコードを実行する。
   */
  run(
    code: string,
    options: RunOptions,
    stdinData?: string,
  ): void;

  /**
   * コンパイルのみ実行する。
   * Server flavor: 未サポート（将来実装）
   * WASM flavor: compile() API を使用
   */
  compile(
    code: string,
    options: CompileOptions,
  ): void;

  /**
   * 実行中プロセスに stdin を送信する（interactive モード）。
   * WASM flavor: 未サポート（no-op）
   */
  sendStdin(data: string): void;

  /**
   * 実行を中止する。
   */
  kill(): void;

  /**
   * リソースを解放する。
   */
  dispose(): void;

  // --- イベントコールバック ---

  onOutput(callback: (entry: OutputEntry) => void): void;
  onStatusChange(callback: (status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void): void;
}

/**
 * ExecutionBackend がサポートする機能を問い合わせる。
 */
export interface ExecutionBackendCapabilities {
  /** interactive stdin をサポートするか */
  supportsInteractiveStdin: boolean;
  /** compile をサポートするか */
  supportsCompile: boolean;
  /** サーバー接続が必要か */
  requiresServer: boolean;
}
```

## ServerExecutionBackend

既存の `useNospaceSocket` のロジックを `ExecutionBackend` 実装に移動する。

### 概要

```typescript
// src/web/services/ServerExecutionBackend.ts

export class ServerExecutionBackend implements ExecutionBackend {
  readonly flavor = 'server' as const;

  private socket: AppSocket | null = null;
  private currentSessionId: string | null = null;
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback: ((status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void) | null = null;

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: true,
    supportsCompile: false,    // 将来実装
    requiresServer: true,
  };

  async init(): Promise<void> {
    this.socket = io();
    return new Promise((resolve, reject) => {
      this.socket!.on('connect', () => {
        this.setupEventListeners();
        resolve();
      });
      this.socket!.on('connect_error', reject);
    });
  }

  isReady(): boolean {
    return this.socket?.connected ?? false;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    if (!this.socket) throw new Error('Not initialized');
    this.socket.emit('nospace_run', { code, options, stdinData });
  }

  compile(_code: string, _options: CompileOptions): void {
    throw new Error('Compile not supported in server flavor');
  }

  sendStdin(data: string): void {
    if (!this.socket || !this.currentSessionId) return;
    this.socket.emit('nospace_stdin', {
      sessionId: this.currentSessionId,
      data,
    });
  }

  kill(): void {
    if (!this.socket || !this.currentSessionId) return;
    this.socket.emit('nospace_kill', {
      sessionId: this.currentSessionId,
    });
  }

  dispose(): void {
    this.socket?.close();
    this.socket = null;
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(callback: (status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void): void {
    this.statusCallback = callback;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('nospace_stdout', (payload) => {
      this.outputCallback?.({
        type: 'stdout',
        data: payload.data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('nospace_stderr', (payload) => {
      this.outputCallback?.({
        type: 'stderr',
        data: payload.data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('nospace_execution_status', (payload) => {
      this.currentSessionId = payload.sessionId;
      this.statusCallback?.(payload.status, payload.sessionId, payload.exitCode);

      // システムメッセージ生成
      let systemMessage: string | null = null;
      if (payload.status === 'running') {
        systemMessage = `[Process started: ${payload.sessionId}]\n`;
      } else if (payload.status === 'finished') {
        systemMessage = `\n[Process exited with code: ${payload.exitCode ?? 'unknown'}]\n`;
      } else if (payload.status === 'killed') {
        systemMessage = `\n[Process killed]\n`;
      } else if (payload.status === 'error') {
        systemMessage = `\n[Process error]\n`;
      }

      if (systemMessage) {
        this.outputCallback?.({
          type: 'system',
          data: systemMessage,
          timestamp: Date.now(),
        });
      }
    });
  }
}
```

## WasmExecutionBackend

WASM API を使用したブラウザ完結型の実行バックエンド。

### 実行モデル

`WasmWhitespaceVM.step(budget)` を使い、一定ステップごとに `setTimeout(0)` で制御をブラウザに返す。
これにより UI のレスポンシブ性を維持する。

```
[init] → [step(BUDGET)] → [flush_stdout] → [emit output] → [setTimeout(0)] → [step(BUDGET)] → ...
                                                                                        ↑
                                                                              UI が描画される
```

### 設計パラメータ

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| `STEP_BUDGET` | 10000 | 1回の step() で実行する命令数 |
| `YIELD_INTERVAL_MS` | 0 | setTimeout の待機時間（0 = microtask 後に yield） |
| `MAX_TOTAL_STEPS` | 100,000,000 | 最大総実行命令数（無限ループ防止） |

### 実装

```typescript
// src/web/services/WasmExecutionBackend.ts

import { initNospace20Wasm, getNospace20 } from '../libs/nospace20/loader';
import type { ExecutionBackend, ExecutionBackendCapabilities } from './ExecutionBackend';

const STEP_BUDGET = 10000;
const MAX_TOTAL_STEPS = 100_000_000;

export class WasmExecutionBackend implements ExecutionBackend {
  readonly flavor = 'wasm' as const;

  private vm: WasmWhitespaceVM | null = null;
  private abortController: AbortController | null = null;
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback: ((status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void) | null = null;
  private ready = false;

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: false,
    supportsCompile: true,
    requiresServer: false,
  };

  async init(): Promise<void> {
    await initNospace20Wasm();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    // 既存の実行を中止
    this.kill();

    const sessionId = crypto.randomUUID();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // 非同期で実行ループを開始
    this.runAsync(code, options, stdinData ?? '', sessionId, signal);
  }

  private async runAsync(
    code: string,
    options: RunOptions,
    stdinData: string,
    sessionId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const nospace20 = await getNospace20();

    try {
      // VM 構築
      // options.language が 'ws' の場合は fromWhitespace を使用
      if (options.language === 'ws') {
        this.vm = nospace20.WasmWhitespaceVM.fromWhitespace(code, stdinData);
      } else {
        this.vm = new nospace20.WasmWhitespaceVM(code, stdinData);
      }

      this.statusCallback?.('running', sessionId);
      this.outputCallback?.({
        type: 'system',
        data: `[WASM execution started]\n`,
        timestamp: Date.now(),
      });

      // ステップ実行ループ
      while (!signal.aborted) {
        const result = this.vm.step(STEP_BUDGET);

        // stdout フラッシュ
        const stdout = this.vm.flush_stdout();
        if (stdout.length > 0) {
          this.outputCallback?.({
            type: 'stdout',
            data: stdout,
            timestamp: Date.now(),
          });
        }

        if (result.status === 'complete') {
          // デバッグ情報
          if (options.debug) {
            const traced = this.vm.get_traced();
            if (traced && Object.keys(traced).length > 0) {
              this.outputCallback?.({
                type: 'stderr',
                data: `[Trace] ${JSON.stringify(traced)}\n`,
                timestamp: Date.now(),
              });
            }
          }

          this.statusCallback?.('finished', sessionId, 0);
          this.outputCallback?.({
            type: 'system',
            data: `\n[WASM execution completed (${this.vm.total_steps()} steps)]\n`,
            timestamp: Date.now(),
          });
          break;
        }

        if (result.status === 'error') {
          this.outputCallback?.({
            type: 'stderr',
            data: result.error ?? 'Unknown error',
            timestamp: Date.now(),
          });
          this.statusCallback?.('error', sessionId);
          this.outputCallback?.({
            type: 'system',
            data: `\n[WASM execution error]\n`,
            timestamp: Date.now(),
          });
          break;
        }

        // 最大ステップ数チェック
        if (this.vm.total_steps() >= MAX_TOTAL_STEPS) {
          this.outputCallback?.({
            type: 'stderr',
            data: `Execution limit reached (${MAX_TOTAL_STEPS} steps)\n`,
            timestamp: Date.now(),
          });
          this.statusCallback?.('killed', sessionId);
          break;
        }

        // UI に制御を返す
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      // abort された場合
      if (signal.aborted) {
        this.statusCallback?.('killed', sessionId);
        this.outputCallback?.({
          type: 'system',
          data: `\n[WASM execution killed]\n`,
          timestamp: Date.now(),
        });
      }

    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.outputCallback?.({
        type: 'stderr',
        data: message + '\n',
        timestamp: Date.now(),
      });
      this.statusCallback?.('error', sessionId);
    } finally {
      this.vm?.free();
      this.vm = null;
    }
  }

  compile(code: string, options: CompileOptions): void {
    const sessionId = crypto.randomUUID();

    (async () => {
      const nospace20 = await getNospace20();

      try {
        this.statusCallback?.('compiling', sessionId);

        const result = nospace20.compile(code, options.target, options.language);

        // result の形式に応じて出力
        // compile() は { ok: string } | { error: string } を返す想定
        if (result.error) {
          this.outputCallback?.({
            type: 'stderr',
            data: result.error + '\n',
            timestamp: Date.now(),
          });
          this.statusCallback?.('error', sessionId);
        } else {
          const output = typeof result === 'string' ? result : (result.ok ?? JSON.stringify(result));
          this.outputCallback?.({
            type: 'stdout',
            data: output + '\n',
            timestamp: Date.now(),
          });
          this.statusCallback?.('finished', sessionId, 0);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.outputCallback?.({
          type: 'stderr',
          data: message + '\n',
          timestamp: Date.now(),
        });
        this.statusCallback?.('error', sessionId);
      }
    })();
  }

  sendStdin(_data: string): void {
    // WASM flavor では interactive stdin 未サポート
    // no-op
  }

  kill(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  dispose(): void {
    this.kill();
    this.vm?.free();
    this.vm = null;
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(callback: (status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void): void {
    this.statusCallback = callback;
  }
}
```

### abort 制御

`AbortController` を使用して実行ループを中断可能にする。
`kill()` 呼び出し時に `AbortController.abort()` を実行し、ステップループの中で `signal.aborted` をチェックする。

### compile API の戻り値

WASM の `compile()` 関数の戻り値は調査が必要。
wasm-bindgen の `any` 型なので、実際に呼び出して返り値の形式を確認する。
想定: `{ ok: string }` または `{ error: string }` のような Result 型。
実装時に実際の戻り値を確認し、適宜調整する。

### メモリ管理

- `WasmWhitespaceVM` は `free()` メソッドでリソースを解放する
- 実行完了・エラー・中止のいずれの場合も `finally` ブロックで `free()` を呼ぶ
- `FinalizationRegistry` による GC 時の自動解放もあるが、明示的な解放を優先する

### Server flavor との違い

| 機能 | Server | WASM |
|------|--------|------|
| interactive stdin | ○ | × |
| compile | ×（将来） | ○ |
| サーバー不要 | × | ○ |
| 実行速度 | ネイティブ | WASM（やや遅い） |
| タイムアウト | サーバー側で制御 | MAX_TOTAL_STEPS で制御 |
| 同時実行 | サーバー側で制御 | シングル（ブラウザ制約） |
