// Socket.IO connection management for nospace protocol

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
