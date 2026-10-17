import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import Config from '../Config';
import {
  ExecutionSlotLimiter,
  ExecutionLimitError,
} from './ExecutionSlotLimiter';
import type { RunOptions, CompileOptions } from '../../interfaces/NospaceTypes';

/** ファイルシステム操作の抽象 */
export interface FileSystem {
  existsSync(path: string): boolean;
  writeFileSync(path: string, data: string, encoding?: string): void;
  unlinkSync(path: string): void;
  mkdirSync(path: string, options?: { recursive: boolean }): void;
}

/** プロセス生成の抽象 */
export interface ProcessSpawner {
  spawn(command: string, args: string[]): ChildProcess;
}

/** 設定値の抽象 */
export interface ExecutionConfig {
  nospaceBinPath: string;
  nospaceTimeout: number;
  /** 同時実行プロセス数の上限 */
  nospaceMaxProcesses: number;
}

/** デフォルトのFileSystem実装 */
const defaultFileSystem: FileSystem = {
  existsSync,
  writeFileSync: (path: string, data: string, encoding?: string) => {
    writeFileSync(path, data, {
      encoding: (encoding as BufferEncoding) || 'utf-8',
    });
  },
  unlinkSync,
  mkdirSync,
};

/** デフォルトのProcessSpawner実装 */
const defaultProcessSpawner: ProcessSpawner = {
  spawn,
};

/** デフォルトのExecutionConfig実装 */
const defaultExecutionConfig: ExecutionConfig = Config;

/** Nospace セッションの実行状態 */
export type SessionStatus = 'running' | 'finished' | 'error' | 'killed';

/** Nospace 実行セッションの公開インターフェース */
export interface NospaceSession {
  readonly sessionId: string;
  readonly status: SessionStatus;
  readonly exitCode: number | null;
  kill(): void;
  sendStdin(data: string): void;
}

/**
 * セッションのイベントコールバック。
 *
 * BUG FIX: 以前のコールバックは sessionId を引数に持たず、呼び出し側が run() の戻り値
 * （session）を参照していた。run() / compile() はエラー時に onExit を同期的に呼ぶため、
 * 戻り値の const が未初期化の状態で参照され ReferenceError（TDZ）となり、socket.io の
 * ハンドラ内の例外としてサーバプロセスが停止していた。
 * 解決策として、sessionId と終了時の status をコールバック引数で渡し、戻り値に依存させない。
 */
export interface SessionCallbacks {
  onStdout: (sessionId: string, data: string) => void;
  onStderr: (sessionId: string, data: string) => void;
  onExit: (
    sessionId: string,
    status: SessionStatus,
    code: number | null
  ) => void;
}

/** 出力の送信先の混雑状況（背圧判定用） */
export interface OutputFlowControl {
  /** 送信待ちが高水位を超えているか */
  isCongested(): boolean;
  /** 送信待ちが捌けたときに呼ばれるリスナーを登録し、解除関数を返す */
  onDrain(listener: () => void): () => void;
}

/** NospaceSession の実装クラス */
class NospaceSessionImpl implements NospaceSession {
  private process: ChildProcess | null;
  private tempFilePath: string;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private _status: SessionStatus = 'running';
  private _exitCode: number | null = null;
  private finalized = false;
  private paused = false;
  private unsubscribeDrain: (() => void) | null = null;

  constructor(
    public readonly sessionId: string,
    process: ChildProcess,
    tempFilePath: string,
    private callbacks: SessionCallbacks,
    private config: ExecutionConfig,
    private fs: FileSystem,
    private releaseSlot: () => void,
    private flowControl?: OutputFlowControl
  ) {
    this.process = process;
    this.tempFilePath = tempFilePath;

    // マルチバイト文字が chunk 境界で分断されないよう、ストリーム側でデコードする
    process.stdout?.setEncoding?.('utf8');
    process.stderr?.setEncoding?.('utf8');

    // Setup stdout handler
    process.stdout?.on('data', (data: string | Buffer) => {
      this.callbacks.onStdout(this.sessionId, data.toString());
      this.pauseIfCongested();
    });

    // Setup stderr handler
    process.stderr?.on('data', (data: string | Buffer) => {
      this.callbacks.onStderr(this.sessionId, data.toString());
      this.pauseIfCongested();
    });

    // 送信待ちが捌けたら出力の読み取りを再開する
    this.unsubscribeDrain =
      flowControl?.onDrain(() => this.resumeIfPossible()) ?? null;

    // Setup close handler
    // BUG FIX: 'exit' イベントは stdio ストリームの読み取り完了を保証しない。
    // 'close' イベントは stdio が閉じた後に発火するため、全 stdout/stderr データの
    // 受信を保証できる。'exit' を使うとコンパイル出力が欠損し実行に失敗する原因になっていた。
    process.on('close', (code: number | null) => {
      this.finalize(code, code === 0 ? 'finished' : 'error');
    });

    // BUG FIX: ChildProcess の 'error' イベントにリスナーがなく、spawn 失敗（EACCES / EAGAIN 等）
    // で未処理の 'error' となりサーバプロセスが停止していた。また spawn 失敗では 'close' が
    // 発火しないことがあり、一時ファイルとタイマーと実行枠が解放されなかった。
    // 解決策として 'error' でも冪等な finalize() を呼ぶ。
    process.on('error', (err: Error) => {
      if (this.finalized) return;
      this.callbacks.onStderr(this.sessionId, `${err.message}\n`);
      this.finalize(null, 'error');
    });

    // Setup timeout
    this.timeoutHandle = setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.callbacks.onStderr(
          this.sessionId,
          `\nProcess timeout (${this.config.nospaceTimeout / 1000}s). Killing...\n`
        );
        this.kill();
      }
    }, this.config.nospaceTimeout);
  }

  get status(): SessionStatus {
    return this._status;
  }

  get exitCode(): number | null {
    return this._exitCode;
  }

  kill(): void {
    if (this.process && !this.process.killed) {
      this._status = 'killed';
      // 一時停止中のままだと残りの出力が読まれず 'close' が来ないため、読み取りを再開する
      this.resumeStreams();
      this.process.kill('SIGTERM');

      // Fallback to SIGKILL after 2 seconds
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 2000);
    }
  }

  sendStdin(data: string): void {
    if (this.process && this.process.stdin && !this.process.stdin.destroyed) {
      this.process.stdin.write(data);
    }
  }

  /**
   * 終了処理。'close' と 'error' の両方から呼ばれるため冪等にする。
   * 一時ファイル・タイマー・実行枠・背圧リスナーを解放し、onExit を一度だけ通知する。
   */
  private finalize(code: number | null, status: SessionStatus): void {
    if (this.finalized) return;
    this.finalized = true;
    this._exitCode = code;
    // Don't overwrite 'killed' status
    if (this._status !== 'killed') {
      this._status = status;
    }
    this.cleanup();
    this.releaseSlot();
    this.callbacks.onExit(this.sessionId, this._status, code);
  }

  /**
   * 送信待ちが溜まっていれば、子プロセスの出力読み取りを止める。
   * パイプが満杯になると子プロセスの write がブロックされ、サーバ内に出力が溜まり続けない。
   */
  private pauseIfCongested(): void {
    if (this.paused || this._status === 'killed' || !this.flowControl) return;
    if (this.flowControl.isCongested()) {
      this.paused = true;
      this.process?.stdout?.pause?.();
      this.process?.stderr?.pause?.();
    }
  }

  private resumeIfPossible(): void {
    if (!this.paused || !this.flowControl) return;
    if (!this.flowControl.isCongested()) {
      this.resumeStreams();
    }
  }

  private resumeStreams(): void {
    if (!this.paused) return;
    this.paused = false;
    this.process?.stdout?.resume?.();
    this.process?.stderr?.resume?.();
  }

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.unsubscribeDrain?.();
    this.unsubscribeDrain = null;

    // Delete temporary file
    try {
      if (this.fs.existsSync(this.tempFilePath)) {
        this.fs.unlinkSync(this.tempFilePath);
      }
    } catch (error) {
      console.error(`Failed to delete temp file ${this.tempFilePath}:`, error);
    }
  }
}

/** Nospace CLI の実行セッションを管理するサービス */
export class NospaceExecutionService {
  private sessions = new Map<string, NospaceSession>();
  private readonly limiter: ExecutionSlotLimiter;

  /** CLI がサポートするコンパイルターゲットのセット（WASM 専用の ex-ws を除く） */
  private static readonly SUPPORTED_COMPILE_TARGETS = new Set([
    'ws',
    'mnemonic',
    'json',
  ]);

  constructor(
    private readonly config: ExecutionConfig = defaultExecutionConfig,
    private readonly fs: FileSystem = defaultFileSystem,
    private readonly spawner: ProcessSpawner = defaultProcessSpawner,
    limiter?: ExecutionSlotLimiter
  ) {
    this.limiter =
      limiter ?? new ExecutionSlotLimiter(config.nospaceMaxProcesses);
  }

  /**
   * Run source code with nospace20 interpreter
   * @throws {ExecutionLimitError} 同時実行数の上限に達している場合
   */
  run(
    code: string,
    options: RunOptions,
    callbacks: SessionCallbacks,
    flowControl?: OutputFlowControl
  ): NospaceSession {
    const args: string[] = [];

    // --std <language>
    args.push('--std', options.language);

    // Debug flags
    if (options.debug) {
      args.push('--debug');
    }
    if (options.ignoreDebug) {
      args.push('--ignore-debug');
    }

    // BUG FIX: stdExtensions が CLI に渡されていなかった。
    // WASM backend は stdExtensions を VM コンストラクタに渡すが、
    // サーバー側では --std-ext フラグとして渡す必要がある。
    for (const ext of options.stdExtensions ?? []) {
      args.push('--std-ext', ext);
    }

    return this.spawnSession(code, args, callbacks, flowControl);
  }

  /**
   * Compile source code with nospace20
   * @throws {ExecutionLimitError} 同時実行数の上限に達している場合
   */
  compile(
    code: string,
    options: CompileOptions,
    callbacks: SessionCallbacks,
    flowControl?: OutputFlowControl
  ): NospaceSession {
    // Validate compile target: ex-ws is WASM-only and not supported by CLI
    if (
      !NospaceExecutionService.SUPPORTED_COMPILE_TARGETS.has(options.target)
    ) {
      return this.failSession(
        randomUUID(),
        `Unsupported compile target: ${options.target}\n`,
        callbacks
      );
    }

    const args: string[] = [];
    args.push('--mode', 'compile');
    args.push('--std', options.language);
    args.push('--target', options.target);

    // BUG FIX: stdExtensions が CLI に渡されておらず、alloc 等の標準拡張を使うコードの
    // コンパイルが失敗していた。CLI は --std-ext <ext> を複数指定可能。
    for (const ext of options.stdExtensions ?? []) {
      args.push('--std-ext', ext);
    }

    return this.spawnSession(code, args, callbacks, flowControl);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): NospaceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove session from registry
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * プロセスを起動せずにエラーで終了するセッションを作り、コールバックへ通知する。
   *
   * BUG FIX: 以前は sessions.set() がコールバック呼び出しより後だったため、コールバック内の
   * removeSession が先に走り、errorSession が Map に残り続けていた（メモリリーク）。
   * また一時ファイルの書き込み失敗は throw されており、socket.io のハンドラ内の例外として
   * サーバプロセスが停止していた。解決策として、先に登録してから通知し、例外は投げない。
   */
  private failSession(
    sessionId: string,
    message: string,
    callbacks: SessionCallbacks
  ): NospaceSession {
    const errorSession: NospaceSession = {
      sessionId,
      status: 'error',
      exitCode: 1,
      kill: () => {},
      sendStdin: () => {},
    };
    this.sessions.set(sessionId, errorSession);
    callbacks.onStderr(sessionId, message);
    callbacks.onExit(sessionId, 'error', 1);
    return errorSession;
  }

  /**
   * 実行枠の確保・一時ファイルへの書き込み・バイナリ存在チェック・プロセス spawn を行う共通処理。
   * run() / compile() の両方から呼び出される。
   */
  private spawnSession(
    code: string,
    args: string[],
    callbacks: SessionCallbacks,
    flowControl?: OutputFlowControl
  ): NospaceSession {
    const releaseSlot = this.limiter.tryAcquire();
    if (!releaseSlot) {
      throw new ExecutionLimitError();
    }

    const sessionId = randomUUID();
    const tmpDir = './tmp';
    const tempFilePath = join(tmpDir, `nospace-${sessionId}.ns`);

    // Write code to temporary file
    try {
      if (!this.fs.existsSync(tmpDir)) {
        this.fs.mkdirSync(tmpDir, { recursive: true });
      }
      this.fs.writeFileSync(tempFilePath, code, 'utf8');
    } catch (error) {
      releaseSlot();
      return this.failSession(
        sessionId,
        `Failed to write temporary file: ${error}\n`,
        callbacks
      );
    }

    // Append file path to args
    args.push(tempFilePath);

    // Check if binary exists
    if (!this.fs.existsSync(this.config.nospaceBinPath)) {
      releaseSlot();
      // Cleanup temp file
      try {
        this.fs.unlinkSync(tempFilePath);
      } catch {
        // 一時ファイルの削除失敗は無視する
      }
      return this.failSession(
        sessionId,
        `nospace20 binary not found at: ${this.config.nospaceBinPath}\n`,
        callbacks
      );
    }

    // Spawn process
    let process: ChildProcess;
    try {
      process = this.spawner.spawn(this.config.nospaceBinPath, args);
    } catch (error) {
      releaseSlot();
      try {
        this.fs.unlinkSync(tempFilePath);
      } catch {
        // 一時ファイルの削除失敗は無視する
      }
      return this.failSession(
        sessionId,
        `Failed to start process: ${error}\n`,
        callbacks
      );
    }

    const session = new NospaceSessionImpl(
      sessionId,
      process,
      tempFilePath,
      callbacks,
      this.config,
      this.fs,
      releaseSlot,
      flowControl
    );

    this.sessions.set(sessionId, session);

    return session;
  }
}

export { ExecutionLimitError };
