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
import { RequestValidator, readRequestId } from './RequestValidator';

/** Socket から出力の混雑状況を取得する OutputFlowControl を生成する関数 */
export type FlowControlFactory = (socket: Socket) => OutputFlowControl;

/** Socket.IO 接続ごとの Nospace 実行リクエストを処理するコントローラー */
export class NospaceController {
  private executionService: NospaceExecutionService;
  private registry = new SocketSessionRegistry();

  /**
   * @param executionService 実行サービス（設定を持つため、呼び出し側が組み立てて渡す）
   * @param flowControlFactory 出力の混雑状況を判定する OutputFlowControl の生成関数
   */
  constructor(
    executionService: NospaceExecutionService,
    private readonly flowControlFactory: FlowControlFactory = (socket) =>
      new SocketFlowControl(socket)
  ) {
    this.executionService = executionService;
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
        // 上限到達（busy）と終了中（shutting down）で、サービスが理由を持つ
        this.emitRequestError(socket, requestId, `${error.message}\n`);
        return null;
      }
      throw error;
    }
    this.registerStartedSession(socket, requestId, session, initialStatus);
    return session;
  }

  private handleRun(socket: Socket, payload: unknown): void {
    // payload は信頼できない入力のため、RequestValidator で検証・正規化してから使う
    const parsed = RequestValidator.parseRun(payload);
    if (!parsed.ok) {
      this.rejectInvalidRequest(socket, parsed);
      return;
    }
    const { requestId, code, options, stdinData } = parsed.value;

    const session = this.startSession(
      socket,
      requestId,
      () =>
        this.executionService.run(
          code,
          options,
          this.createCallbacks(socket, requestId),
          this.flowControlFactory(socket)
        ),
      'running'
    );

    // batch モードでは入力を渡し終えたら stdin を閉じる。閉じないと、入力を最後まで読む
    // プログラムは EOF を受け取れず、タイムアウトまで待ち続ける
    if (
      session &&
      session.status === 'running' &&
      options.inputMode === 'batch'
    ) {
      if (stdinData !== undefined) {
        session.sendStdin(stdinData);
      }
      session.closeStdin();
    }
  }

  private handleCompile(socket: Socket, payload: unknown): void {
    const parsed = RequestValidator.parseCompile(payload);
    if (!parsed.ok) {
      this.rejectInvalidRequest(socket, parsed);
      return;
    }
    const { requestId, code, options } = parsed.value;

    this.startSession(
      socket,
      requestId,
      () =>
        this.executionService.compile(
          code,
          options,
          this.createCallbacks(socket, requestId),
          this.flowControlFactory(socket)
        ),
      'compiling'
    );
  }

  /** 検証に失敗した要求を拒否する。通知先（requestId）が分かる場合のみ、エラーを返す */
  private rejectInvalidRequest(
    socket: Socket,
    failure: { requestId: string | null; message: string }
  ): void {
    if (failure.requestId) {
      this.emitRequestError(socket, failure.requestId, `${failure.message}\n`);
    }
  }

  private handleStdinInput(socket: Socket, payload: unknown): void {
    const parsed = RequestValidator.parseStdin(payload);
    if (!parsed.ok) return;
    const { sessionId, data } = parsed.value;
    if (!this.registry.isOwner(socket.id, sessionId)) return;

    const session = this.executionService.getSession(sessionId);
    if (session && session.status === 'running') {
      // Add newline if not present
      const inputData = data.endsWith('\n') ? data : data + '\n';
      session.sendStdin(inputData);
    }
  }

  private handleKill(socket: Socket, payload: unknown): void {
    const parsed = RequestValidator.parseKill(payload);
    if (!parsed.ok) return;
    const { sessionId } = parsed.value;
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
