import { randomUUID } from 'crypto';
import { Socket } from 'socket.io';
import {
  NospaceExecutionService,
  type NospaceSession,
  type OutputFlowControl,
  type SessionCallbacks,
} from '../Services/NospaceExecutionService';
import { ExecutionLimitError } from '../Services/ExecutionSlotLimiter';
import { SocketSessionRegistry } from './SocketSessionRegistry';
import { SocketFlowControl } from '../Web/SocketFlowControl';
import type { RunOptions, CompileOptions } from '../../interfaces/NospaceTypes';

/** requestId として受け付ける最大文字数 */
const MAX_REQUEST_ID_LENGTH = 64;

/** Socket から出力の混雑状況を取得する OutputFlowControl を生成する関数 */
export type FlowControlFactory = (socket: Socket) => OutputFlowControl;

/** payload から requestId を取り出す。不正な場合は null */
function readRequestId(payload: unknown): string | null {
  const requestId = (payload as { requestId?: unknown } | null | undefined)
    ?.requestId;
  if (
    typeof requestId === 'string' &&
    requestId.length > 0 &&
    requestId.length <= MAX_REQUEST_ID_LENGTH
  ) {
    return requestId;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Socket.IO 接続ごとの Nospace 実行リクエストを処理するコントローラー */
export class NospaceController {
  private executionService: NospaceExecutionService;
  private registry = new SocketSessionRegistry();

  constructor(
    executionService?: NospaceExecutionService,
    private readonly flowControlFactory: FlowControlFactory = (socket) =>
      new SocketFlowControl(socket)
  ) {
    this.executionService = executionService ?? new NospaceExecutionService();
  }

  handleConnection(socket: Socket): void {
    // BUG FIX: socket.io はハンドラを process.nextTick から呼ぶため、ハンドラ内で例外が
    // 漏れると uncaughtException となりサーバプロセス全体が停止していた
    // （payload なしの emit や不正な型の payload など）。
    // 解決策として全ハンドラを guard() で包み、例外はログに残して当該要求のエラーとして通知する。
    socket.on('nospace_run', (payload) =>
      this.guard(socket, 'nospace_run', payload, () =>
        this.handleRun(socket, payload)
      )
    );

    socket.on('nospace_compile', (payload) =>
      this.guard(socket, 'nospace_compile', payload, () =>
        this.handleCompile(socket, payload)
      )
    );

    socket.on('nospace_stdin', (payload) =>
      this.guard(socket, 'nospace_stdin', payload, () =>
        this.handleStdinInput(socket, payload)
      )
    );

    socket.on('nospace_kill', (payload) =>
      this.guard(socket, 'nospace_kill', payload, () =>
        this.handleKill(socket, payload)
      )
    );

    socket.on('disconnect', () =>
      this.guard(socket, 'disconnect', undefined, () =>
        this.handleDisconnect(socket)
      )
    );
  }

  /** ハンドラの例外を捕捉し、requestId が取れる場合は要求のエラーとして通知する */
  private guard(
    socket: Socket,
    event: string,
    payload: unknown,
    handler: () => void
  ): void {
    try {
      handler();
    } catch (error) {
      console.error(`[NospaceController] ${event} failed:`, error);
      const requestId = readRequestId(payload);
      if (requestId) {
        this.emitRequestError(
          socket,
          requestId,
          'Internal server error while handling the request.\n'
        );
      }
    }
  }

  /** セッションを作れなかった要求に対し、エラー出力と error ステータスを通知する */
  private emitRequestError(
    socket: Socket,
    requestId: string,
    message: string
  ): void {
    const sessionId = randomUUID();
    socket.emit('nospace_stderr', { requestId, sessionId, data: message });
    socket.emit('nospace_execution_status', {
      requestId,
      sessionId,
      status: 'error',
      exitCode: null,
    });
  }

  /** 要求に紐づくイベント通知用のコールバックを作る（sessionId はサービスから渡される） */
  private createCallbacks(socket: Socket, requestId: string): SessionCallbacks {
    return {
      onStdout: (sessionId, data) => {
        socket.emit('nospace_stdout', { requestId, sessionId, data });
      },
      onStderr: (sessionId, data) => {
        socket.emit('nospace_stderr', { requestId, sessionId, data });
      },
      onExit: (sessionId, status, exitCode) => {
        socket.emit('nospace_execution_status', {
          requestId,
          sessionId,
          status,
          exitCode,
        });
        this.executionService.removeSession(sessionId);
        // 旧セッションの終了が新セッションの登録を消さないよう、一致する場合のみ削除する
        this.registry.deleteIfMatch(socket.id, sessionId);
      },
    };
  }

  /** このソケットが保持している実行中セッションがあれば終了させる */
  private killExistingSession(socket: Socket): void {
    const existing = this.registry.get(socket.id);
    if (!existing) return;
    this.executionService.getSession(existing.sessionId)?.kill();
    this.executionService.removeSession(existing.sessionId);
    this.registry.delete(socket.id);
  }

  /**
   * セッション開始後の登録と初期ステータス通知を行う。
   * run() / compile() はエラー時に onExit を同期的に呼ぶため、戻り時点で終了済みのセッションは
   * 登録せず、初期ステータスも通知しない（通知順序が逆転して UI が固着するのを防ぐ）。
   */
  private registerStartedSession(
    socket: Socket,
    requestId: string,
    session: NospaceSession,
    initialStatus: 'running' | 'compiling'
  ): void {
    if (session.status !== 'running') return;
    this.registry.set(socket.id, {
      sessionId: session.sessionId,
      requestId,
    });
    socket.emit('nospace_execution_status', {
      requestId,
      sessionId: session.sessionId,
      status: initialStatus,
      exitCode: null,
    });
  }

  /** run / compile 共通: サービス呼び出しを行い、起動できなかった場合は要求のエラーとして通知する */
  private startSession(
    socket: Socket,
    requestId: string,
    start: () => NospaceSession,
    initialStatus: 'running' | 'compiling'
  ): NospaceSession | null {
    this.killExistingSession(socket);
    let session: NospaceSession;
    try {
      session = start();
    } catch (error) {
      if (error instanceof ExecutionLimitError) {
        this.emitRequestError(
          socket,
          requestId,
          'Server is busy: too many running processes. Please retry later.\n'
        );
        return null;
      }
      throw error;
    }
    this.registerStartedSession(socket, requestId, session, initialStatus);
    return session;
  }

  private handleRun(socket: Socket, payload: unknown): void {
    const requestId = readRequestId(payload);
    if (!requestId) return;
    const { code, options, stdinData } = payload as {
      code: unknown;
      options: unknown;
      stdinData?: unknown;
    };
    if (typeof code !== 'string' || !isObject(options)) {
      this.emitRequestError(socket, requestId, 'Invalid run request.\n');
      return;
    }
    const runOptions = options as unknown as RunOptions;

    const session = this.startSession(
      socket,
      requestId,
      () =>
        this.executionService.run(
          code,
          runOptions,
          this.createCallbacks(socket, requestId),
          this.flowControlFactory(socket)
        ),
      'running'
    );

    // If batch mode, send stdin data
    if (
      session &&
      session.status === 'running' &&
      runOptions.inputMode === 'batch' &&
      typeof stdinData === 'string'
    ) {
      session.sendStdin(stdinData);
      // Note: We don't explicitly close stdin here as the process
      // should handle EOF when stdin stream ends
    }
  }

  private handleCompile(socket: Socket, payload: unknown): void {
    const requestId = readRequestId(payload);
    if (!requestId) return;
    const { code, options } = payload as { code: unknown; options: unknown };
    if (typeof code !== 'string' || !isObject(options)) {
      this.emitRequestError(socket, requestId, 'Invalid compile request.\n');
      return;
    }
    const compileOptions = options as unknown as CompileOptions;

    this.startSession(
      socket,
      requestId,
      () =>
        this.executionService.compile(
          code,
          compileOptions,
          this.createCallbacks(socket, requestId),
          this.flowControlFactory(socket)
        ),
      'compiling'
    );
  }

  private handleStdinInput(socket: Socket, payload: unknown): void {
    if (!isObject(payload)) return;
    const { sessionId, data } = payload;
    if (typeof sessionId !== 'string' || typeof data !== 'string') return;
    if (!this.registry.isOwner(socket.id, sessionId)) return;

    const session = this.executionService.getSession(sessionId);
    if (session && session.status === 'running') {
      // Add newline if not present
      const inputData = data.endsWith('\n') ? data : data + '\n';
      session.sendStdin(inputData);
    }
  }

  private handleKill(socket: Socket, payload: unknown): void {
    if (!isObject(payload)) return;
    const { sessionId } = payload;
    if (typeof sessionId !== 'string') return;
    const entry = this.registry.get(socket.id);
    if (!entry || entry.sessionId !== sessionId) return;

    const session = this.executionService.getSession(sessionId);
    if (session) {
      session.kill();
      // SIGTERM を無視するプロセスでも UI を即時に復帰させるため、killed を先に通知する
      socket.emit('nospace_execution_status', {
        requestId: entry.requestId,
        sessionId,
        status: 'killed',
        exitCode: null,
      });
    }
  }

  private handleDisconnect(socket: Socket): void {
    const entry = this.registry.get(socket.id);
    if (entry) {
      const session = this.executionService.getSession(entry.sessionId);
      if (session) {
        session.kill();
        this.executionService.removeSession(entry.sessionId);
      }
      this.registry.delete(socket.id);
    }
  }
}
