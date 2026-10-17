// ExecutionBackend abstraction for websocket and WASM execution environments

import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';
import type { NospaceErrorEntry } from '../libs/formatNospaceErrors';

/**
 * サーバとの接続状態。
 * - connected: 再接続が完了した
 * - reconnecting: 切断され、自動再接続を試みている
 * - lost: サーバ側から意図的に切断され、自動再接続は行われない（再生成が必要）
 */
export type ConnectionState = 'connected' | 'reconnecting' | 'lost';

/**
 * Execution backend abstract interface.
 * Provides a common API for WebSocket flavor and WASM flavor.
 */
export interface ExecutionBackend {
  /** Backend flavor type */
  readonly flavor: 'websocket' | 'wasm';

  /**
   * Initialize the backend.
   * Server: establish Socket.IO connection
   * WASM: load WASM module
   */
  init(): Promise<void>;

  /**
   * Check if the backend is ready for execution.
   */
  isReady(): boolean;

  /**
   * Execute source code.
   */
  run(code: string, options: RunOptions, stdinData?: string): void;

  /**
   * Compile only (no execution).
   * WebSocket flavor: not supported (future implementation)
   * WASM flavor: use compile() API
   */
  compile(code: string, options: CompileOptions): void;

  /**
   * Send stdin to running process (interactive mode).
   * WASM flavor: not supported (no-op)
   */
  sendStdin(data: string): void;

  /**
   * Kill running process.
   */
  kill(): void;

  /**
   * Release resources.
   */
  dispose(): void;

  // --- Event callbacks ---

  onOutput(callback: (entry: OutputEntry) => void): void;
  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null
    ) => void
  ): void;
  /**
   * コンパイルエラー発生時に構造化エラー配列を通知するコールバックを設定する。
   * WebSocket flavor は未対応のため no-op で実装する。
   */
  onCompileErrors(callback: (errors: NospaceErrorEntry[]) => void): void;
  /**
   * サーバとの接続状態の変化を通知するコールバックを設定する。
   * サーバ接続を持たない backend（WASM）は実装しない。
   */
  onConnectionChange?(callback: (state: ConnectionState) => void): void;
}

/**
 * Query backend capabilities.
 */
export interface ExecutionBackendCapabilities {
  /** Supports interactive stdin */
  supportsInteractiveStdin: boolean;
  /** Supports compile */
  supportsCompile: boolean;
  /** Supports ignoreDebug option */
  supportsIgnoreDebug: boolean;
  /** Supports language subset selection for run */
  supportsLanguageSubsetForRun: boolean;
  /** Requires server connection */
  requiresServer: boolean;
}
