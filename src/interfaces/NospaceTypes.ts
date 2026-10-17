// Common types for nospace execution

/** nospace の言語サブセット */
export type LanguageSubset = 'standard' | 'min' | 'ws';
/** コンパイル出力フォーマット */
export type CompileTarget = 'ws' | 'mnemonic' | 'ex-ws' | 'json';
/** 標準入力モード */
export type InputMode = 'interactive' | 'batch';
/** 実行状態 */
export type ExecutionStatus =
  | 'idle'
  | 'compiling'
  | 'running'
  | 'finished'
  | 'error'
  | 'killed';

/** コンパイルオプション */
export interface CompileOptions {
  /** Language subset */
  language: LanguageSubset;
  /** Compile output format */
  target: CompileTarget;
  /** 有効にする標準拡張 */
  stdExtensions: string[];
  /** 有効にする最適化パス */
  optPasses: string[];
}

/** 実行オプション */
export interface ExecutionOptions {
  /** Enable debug trace */
  debug: boolean;
  /** Disable debug built-in functions */
  ignoreDebug: boolean;
  /** Standard input mode */
  inputMode: InputMode;
  /** WASM: 1回の vm.step() コールで実行する命令数 (default: 10000) */
  stepBudget: number;
  /** WASM: 最大総実行ステップ数 (default: 100_000_000) */
  maxTotalSteps: number;
  /** 有効にする最適化パス（WASM only） */
  optPasses: string[];
}

/** 実行リクエストオプション（コンパイルと実行を統合） */
export interface RunOptions {
  /** Language subset */
  language: LanguageSubset;
  /** Enable debug trace */
  debug: boolean;
  /** Disable debug built-in functions */
  ignoreDebug: boolean;
  /** Standard input mode */
  inputMode: InputMode;
  /** WASM only: 1回の vm.step() コールで実行する命令数 */
  stepBudget?: number;
  /** WASM only: 最大総実行ステップ数 */
  maxTotalSteps?: number;
  /** 有効にする最適化パス（WASM only） */
  optPasses?: string[];
  /** 有効にする標準拡張 */
  stdExtensions?: string[];
  /** WasmNospaceVM を使用した直接インタプリタ実行を行うか（WASM only） */
  direct?: boolean;
}

// --- Socket.IO event types ---

/**
 * クライアントからサーバへの Socket.IO イベント定義。
 * run / compile は、クライアントが発行した requestId を持つ。サーバはその要求に起因する
 * 全イベントに同じ requestId を付けて返し、クライアントは現在の要求以外のイベントを破棄する。
 */
export interface NospaceClientToServerEvents {
  /** Run request */
  nospace_run: (payload: {
    requestId: string;
    code: string;
    options: RunOptions;
    stdinData?: string; // Batch mode stdin data
  }) => void;

  /** Compile request */
  nospace_compile: (payload: {
    requestId: string;
    code: string;
    options: CompileOptions;
  }) => void;

  /** Send stdin to running process (interactive mode) */
  nospace_stdin: (payload: { sessionId: string; data: string }) => void;

  /** Kill running process */
  nospace_kill: (payload: { sessionId: string }) => void;
}

/** サーバからクライアントへの Socket.IO イベント定義（全イベントが requestId を持つ） */
export interface NospaceServerToClientEvents {
  /** Stdout data (streaming) */
  nospace_stdout: (payload: {
    requestId: string;
    sessionId: string;
    data: string;
  }) => void;

  /** Stderr data (streaming) */
  nospace_stderr: (payload: {
    requestId: string;
    sessionId: string;
    data: string;
  }) => void;

  /** Execution status change */
  nospace_execution_status: (payload: {
    requestId: string;
    sessionId: string;
    status: ExecutionStatus;
    exitCode?: number | null;
  }) => void;
}

// --- Output panel types ---

/** 出力エントリの種別 */
export type OutputEntryType = 'stdout' | 'stderr' | 'stdin-echo' | 'system';

/** 出力パネルに表示するエントリ */
export interface OutputEntry {
  type: OutputEntryType;
  data: string;
  timestamp: number;
}
