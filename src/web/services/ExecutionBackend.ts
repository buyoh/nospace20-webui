// ExecutionBackend abstraction for websocket and WASM execution environments

import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';

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
      exitCode?: number | null,
    ) => void,
  ): void;
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
