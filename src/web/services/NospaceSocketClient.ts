// Socket.IO connection management for nospace protocol

import { Socket } from 'socket.io-client';
import type {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
  RunOptions,
  CompileOptions,
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
  onStdout: (payload: {
    requestId: string;
    sessionId: string;
    data: string;
  }) => void;
  onStderr: (payload: {
    requestId: string;
    sessionId: string;
    data: string;
  }) => void;
  onExecutionStatus: (payload: {
    requestId: string;
    sessionId: string;
    status: string;
    exitCode?: number | null;
  }) => void;
  /**
   * 初回接続成功後に接続が切れたとき。
   * reason が 'io server disconnect'（サーバ側の意図的な切断）の場合、自動再接続は行われない。
   */
  onDisconnect?: (reason: string) => void;
  /** 切断後に再接続したとき */
  onReconnect?: () => void;
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
   *
   * BUG FIX: 以前は 'connect' リスナーの中でデータ系リスナーを登録していたため、
   * socket.io-client の自動再接続のたびにリスナーが追加され、出力が 2 重・3 重に表示されていた。
   * また 'disconnect' を購読していなかったため、実行中に切断されると UI が「実行中」のまま
   * 固着した。さらに初回接続のタイムアウト時に socket を close しなかったため、
   * バックグラウンドで再接続が続いていた。
   * 解決策として、リスナーは socket 生成直後に一度だけ登録し、'connect' は永続リスナー 1 つで
   * 初回（resolve）と再接続（onReconnect）を分岐する。失敗時は socket を close する。
   *
   * @param handlers 受信イベントのコールバック
   * @param timeoutMs 接続タイムアウト（デフォルト: 10000ms）
   */
  async connect(
    handlers: NospaceSocketEventHandlers,
    timeoutMs = 10000
  ): Promise<void> {
    const socket = this.socketFactory();
    if (!socket) {
      throw new Error('Failed to create Socket client');
    }
    this.socket = socket;

    socket.on('nospace_stdout', handlers.onStdout);
    socket.on('nospace_stderr', handlers.onStderr);
    socket.on('nospace_execution_status', handlers.onExecutionStatus);

    return new Promise((resolve, reject) => {
      let hasConnected = false;

      const failInitialConnect = (error: Error) => {
        // 初回接続に失敗した socket は、バックグラウンドで再接続を続けないよう破棄する
        socket.close();
        if (this.socket === socket) this.socket = null;
        reject(error);
      };

      const timeout = setTimeout(() => {
        failInitialConnect(new Error('Socket.IO connection timeout'));
      }, timeoutMs);

      socket.on('connect', () => {
        if (!hasConnected) {
          hasConnected = true;
          clearTimeout(timeout);
          resolve();
        } else {
          handlers.onReconnect?.();
        }
      });

      socket.on('connect_error', (error) => {
        // 初回接続後の connect_error は、socket.io-client の自動再接続に任せる
        if (hasConnected) return;
        clearTimeout(timeout);
        failInitialConnect(error);
      });

      socket.on('disconnect', (reason) => {
        if (hasConnected) handlers.onDisconnect?.(reason);
      });
    });
  }

  /** 接続済みかどうか */
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** 実行リクエストを送信 */
  emitRun(
    requestId: string,
    code: string,
    options: RunOptions,
    stdinData?: string
  ): void {
    this.requireConnected().emit('nospace_run', {
      requestId,
      code,
      options,
      stdinData,
    });
  }

  /** コンパイルリクエストを送信 */
  emitCompile(requestId: string, code: string, options: CompileOptions): void {
    this.requireConnected().emit('nospace_compile', {
      requestId,
      code,
      options,
    });
  }

  /** stdin データを送信 */
  emitStdin(sessionId: string, data: string): void {
    this.requireConnected().emit('nospace_stdin', { sessionId, data });
  }

  /** kill リクエストを送信 */
  emitKill(sessionId: string): void {
    this.requireConnected().emit('nospace_kill', { sessionId });
  }

  /** 接続を切断しリソースを解放 */
  close(): void {
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
  }

  /**
   * 接続中の socket を返す。未接続なら例外を投げる。
   * socket.io-client は未接続時の emit をバッファして再接続時に送信してしまう。
   * クライアントが結果を捨てた後でサーバ側でプロセスが走るのを防ぐため、未接続時は送信しない。
   */
  private requireConnected(): AppSocket {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Socket not connected');
    }
    return this.socket;
  }
}
