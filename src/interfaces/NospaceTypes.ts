// Common types for nospace execution

export type LanguageSubset = 'standard' | 'min' | 'ws';
export type CompileTarget = 'ws' | 'mnemonic' | 'ex-ws' | 'json';
export type InputMode = 'interactive' | 'batch';
export type ExecutionStatus =
  | 'idle'
  | 'compiling'
  | 'running'
  | 'finished'
  | 'error'
  | 'killed';

export interface CompileOptions {
  /** Language subset */
  language: LanguageSubset;
  /** Compile output format */
  target: CompileTarget;
}

export interface ExecutionOptions {
  /** Enable debug trace */
  debug: boolean;
  /** Disable debug built-in functions */
  ignoreDebug: boolean;
  /** Standard input mode */
  inputMode: InputMode;
}

export interface RunOptions {
  /** Language subset */
  language: LanguageSubset;
  /** Enable debug trace */
  debug: boolean;
  /** Disable debug built-in functions */
  ignoreDebug: boolean;
  /** Standard input mode */
  inputMode: InputMode;
}

// --- Socket.IO event types ---

export interface NospaceClientToServerEvents {
  /** Run request */
  nospace_run: (payload: {
    code: string;
    options: RunOptions;
    stdinData?: string; // Batch mode stdin data
  }) => void;

  /** Send stdin to running process (interactive mode) */
  nospace_stdin: (payload: { sessionId: string; data: string }) => void;

  /** Kill running process */
  nospace_kill: (payload: { sessionId: string }) => void;
}

export interface NospaceServerToClientEvents {
  /** Stdout data (streaming) */
  nospace_stdout: (payload: { sessionId: string; data: string }) => void;

  /** Stderr data (streaming) */
  nospace_stderr: (payload: { sessionId: string; data: string }) => void;

  /** Execution status change */
  nospace_execution_status: (payload: {
    sessionId: string;
    status: ExecutionStatus;
    exitCode?: number | null;
  }) => void;
}

// --- Output panel types ---

export type OutputEntryType = 'stdout' | 'stderr' | 'stdin-echo' | 'system';

export interface OutputEntry {
  type: OutputEntryType;
  data: string;
  timestamp: number;
}
