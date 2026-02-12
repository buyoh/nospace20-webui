import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import Config from '../Config';
import type { RunOptions } from '../../interfaces/NospaceTypes';

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

export type SessionStatus = 'running' | 'finished' | 'error' | 'killed';

/** Nospace 実行セッションの公開インターフェース */
export interface NospaceSession {
  readonly sessionId: string;
  readonly status: SessionStatus;
  readonly exitCode: number | null;
  kill(): void;
  sendStdin(data: string): void;
}

/** セッションのイベントコールバック */
interface SessionCallbacks {
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onExit: (code: number | null) => void;
}

/** NospaceSession の実装クラス */
class NospaceSessionImpl implements NospaceSession {
  private process: ChildProcess | null;
  private tempFilePath: string;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private _status: SessionStatus = 'running';
  private _exitCode: number | null = null;

  constructor(
    public readonly sessionId: string,
    process: ChildProcess,
    tempFilePath: string,
    private callbacks: SessionCallbacks,
    private config: ExecutionConfig,
    private fs: FileSystem
  ) {
    this.process = process;
    this.tempFilePath = tempFilePath;

    // Setup stdout handler
    process.stdout?.on('data', (data: Buffer) => {
      this.callbacks.onStdout(data.toString());
    });

    // Setup stderr handler
    process.stderr?.on('data', (data: Buffer) => {
      this.callbacks.onStderr(data.toString());
    });

    // Setup exit handler
    process.on('exit', (code: number | null) => {
      this._exitCode = code;
      // Don't overwrite 'killed' status
      if (this._status !== 'killed') {
        this._status = code === 0 ? 'finished' : 'error';
      }
      this.cleanup();
      this.callbacks.onExit(code);
    });

    // Setup timeout
    this.timeoutHandle = setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.callbacks.onStderr(
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

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

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

export class NospaceExecutionService {
  private sessions = new Map<string, NospaceSession>();

  constructor(
    private readonly config: ExecutionConfig = defaultExecutionConfig,
    private readonly fs: FileSystem = defaultFileSystem,
    private readonly spawner: ProcessSpawner = defaultProcessSpawner
  ) {}

  /**
   * Run source code with nospace20 interpreter
   */
  run(
    code: string,
    options: RunOptions,
    callbacks: SessionCallbacks
  ): NospaceSession {
    const sessionId = randomUUID();

    // Create tmp directory if not exists
    const tmpDir = './tmp';
    if (!this.fs.existsSync(tmpDir)) {
      this.fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Write code to temporary file
    const tempFilePath = join(tmpDir, `nospace-${sessionId}.ns`);
    try {
      this.fs.writeFileSync(tempFilePath, code, 'utf8');
    } catch (error) {
      callbacks.onStderr(`Failed to write temporary file: ${error}\n`);
      callbacks.onExit(1);
      throw error;
    }

    // Build command arguments
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

    // File path
    args.push(tempFilePath);

    // Check if binary exists
    if (!this.fs.existsSync(this.config.nospaceBinPath)) {
      const errorMsg = `nospace20 binary not found at: ${this.config.nospaceBinPath}\n`;
      callbacks.onStderr(errorMsg);
      callbacks.onExit(1);

      // Cleanup temp file
      try {
        this.fs.unlinkSync(tempFilePath);
      } catch {}

      // Create error session
      const errorSession: NospaceSession = {
        sessionId,
        status: 'error',
        exitCode: 1,
        kill: () => {},
        sendStdin: () => {},
      };
      this.sessions.set(sessionId, errorSession);
      return errorSession;
    }

    // Spawn process
    const process = this.spawner.spawn(this.config.nospaceBinPath, args);

    const session = new NospaceSessionImpl(
      sessionId,
      process,
      tempFilePath,
      callbacks,
      this.config,
      this.fs
    );

    this.sessions.set(sessionId, session);

    return session;
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
}
