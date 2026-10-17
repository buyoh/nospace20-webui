// WebSocket flavor execution backend using Socket.IO

import { io } from 'socket.io-client';
import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';
import type {
  ConnectionState,
  ExecutionBackend,
  ExecutionBackendCapabilities,
} from './ExecutionBackend';
import { NospaceSocketClient, type SocketFactory } from './NospaceSocketClient';
import {
  tryFormatNospaceErrorJson,
  tryParseNospaceErrors,
} from '../libs/formatNospaceErrors';
import type { NospaceErrorEntry } from '../libs/formatNospaceErrors';

const defaultSocketFactory: SocketFactory = () => io();

/** 実行要求の識別子を生成する関数 */
export type RequestIdGenerator = () => string;

/**
 * 既定の requestId 生成器。
 * crypto.randomUUID は HTTPS / localhost 以外（secure context 外）では使えないため依存しない。
 */
function createDefaultRequestIdGenerator(): RequestIdGenerator {
  let counter = 0;
  return () =>
    `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
}

/** 終端のステータス（以降、その要求のイベントは無視する） */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'finished',
  'error',
  'killed',
]);

/**
 * サーバー (Socket.IO) を使用した実行バックエンド。
 * NospaceSocketClient に接続管理を委譲し、ビジネスロジック
 * （OutputEntry 変換、システムメッセージ生成、セッション管理）のみを担当する。
 */
export class ServerExecutionBackend implements ExecutionBackend {
  readonly flavor = 'websocket' as const;

  private client: NospaceSocketClient;
  private readonly generateRequestId: RequestIdGenerator;
  /** 現在の実行要求。これと異なる requestId のイベントは破棄する */
  private activeRequestId: string | null = null;
  /** 現在の要求が終端ステータス（finished / error / killed）に達したか */
  private activeTerminated = false;
  private currentSessionId: string | null = null;
  /** sessionId が確定する前に要求された kill（確定時に送信する） */
  private pendingKill = false;
  /** sessionId が確定する前に要求された stdin（確定時に順に送信する） */
  private pendingStdin: string[] = [];
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback:
    | ((
        status: ExecutionStatus,
        sessionId: string,
        exitCode?: number | null
      ) => void)
    | null = null;
  private compileErrorsCallback:
    | ((errors: NospaceErrorEntry[]) => void)
    | null = null;
  private connectionCallback: ((state: ConnectionState) => void) | null = null;

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: true,
    supportsCompile: true,
    supportsIgnoreDebug: true,
    supportsLanguageSubsetForRun: true,
    requiresServer: true,
  };

  constructor(
    socketFactory: SocketFactory = defaultSocketFactory,
    generateRequestId: RequestIdGenerator = createDefaultRequestIdGenerator()
  ) {
    this.client = new NospaceSocketClient(socketFactory);
    this.generateRequestId = generateRequestId;
  }

  /**
   * 受信イベントが現在の要求のものか判定する。
   *
   * BUG FIX: 以前はイベントを sessionId で照合せず、新しい実行を開始した後に届いた
   * 旧セッションの killed / finished や遅延した出力が、新しい実行の状態・出力に混入していた
   * （新しいプロセスが動いているのに Stop が無効になる等）。
   * 解決策として、クライアントが発行した requestId が現在の要求と一致するイベントだけを受け付け、
   * 終端ステータス以降（kill 時の killed と close 時の status の重複など）は無視する。
   */
  private accepts(payload: { requestId?: string }): boolean {
    return (
      this.activeRequestId !== null &&
      !this.activeTerminated &&
      payload.requestId === this.activeRequestId
    );
  }

  private beginRequest(): string {
    const requestId = this.generateRequestId();
    this.activeRequestId = requestId;
    this.activeTerminated = false;
    this.currentSessionId = null;
    this.pendingKill = false;
    this.pendingStdin = [];
    return requestId;
  }

  private terminateActiveRequest(): void {
    this.activeTerminated = true;
    this.pendingKill = false;
    this.pendingStdin = [];
  }

  /** sessionId 確定前に要求された kill / stdin を送信する */
  private flushPending(sessionId: string): void {
    try {
      if (this.pendingKill) {
        this.client.emitKill(sessionId);
      } else {
        for (const data of this.pendingStdin) {
          this.client.emitStdin(sessionId, data);
        }
      }
    } catch {
      // 切断中: サーバ側でセッションは kill 済みのため送信不要
    }
    this.pendingKill = false;
    this.pendingStdin = [];
  }

  async init(): Promise<void> {
    await this.client.connect({
      onStdout: (payload) => {
        if (!this.accepts(payload)) return;
        this.outputCallback?.({
          type: 'stdout',
          data: payload.data,
          timestamp: Date.now(),
        });
      },
      onStderr: (payload) => {
        if (!this.accepts(payload)) return;
        // BUG FIX: nospace バイナリがコンパイルエラー時に JSON を stderr に出力するため、
        // JSON をパースして整形されたメッセージに変換する。パースに失敗した場合はそのまま表示。
        const formatted = tryFormatNospaceErrorJson(payload.data);
        this.outputCallback?.({
          type: 'stderr',
          data: formatted ?? payload.data,
          timestamp: Date.now(),
        });

        // 構造化エラーをコンパイルエラーコールバックに渡す（WASM flavor と同様の動作）
        const parsed = tryParseNospaceErrors(payload.data);
        if (parsed) {
          this.compileErrorsCallback?.(parsed);
        }
      },
      onExecutionStatus: (payload) => {
        if (!this.accepts(payload)) return;
        const status = payload.status as ExecutionStatus;
        const terminal = TERMINAL_STATUSES.has(status);
        const adopting = this.currentSessionId === null;
        if (adopting) {
          this.currentSessionId = payload.sessionId;
        }
        if (terminal) {
          this.terminateActiveRequest();
        } else if (adopting) {
          this.flushPending(payload.sessionId);
        }
        this.statusCallback?.(status, payload.sessionId, payload.exitCode);
        this.emitSystemMessage(status, payload.exitCode);
      },
      // BUG FIX: 切断を検知していなかったため、実行中にサーバ再起動やネットワーク瞬断が起きると
      // UI が「実行中」のまま固着していた（サーバは切断時にセッションを kill 済み）。
      // 解決策として、実行中の要求を error で終了させ、接続状態を通知する。
      onDisconnect: (reason) => {
        if (this.activeRequestId !== null && !this.activeTerminated) {
          this.terminateActiveRequest();
          this.statusCallback?.('error', this.currentSessionId ?? '', null);
          this.outputCallback?.({
            type: 'system',
            data: `\n[Connection lost: ${reason}]\n`,
            timestamp: Date.now(),
          });
        }
        this.connectionCallback?.(
          reason === 'io server disconnect' ? 'lost' : 'reconnecting'
        );
      },
      onReconnect: () => {
        this.connectionCallback?.('connected');
      },
    });
  }

  isReady(): boolean {
    return this.client.connected;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    const requestId = this.beginRequest();
    try {
      this.client.emitRun(requestId, code, options, stdinData);
    } catch (err) {
      this.activeRequestId = null;
      throw err;
    }
  }

  compile(code: string, options: CompileOptions): void {
    const requestId = this.beginRequest();
    try {
      this.client.emitCompile(requestId, code, options);
    } catch (err) {
      this.activeRequestId = null;
      throw err;
    }
  }

  sendStdin(data: string): void {
    if (this.activeRequestId === null || this.activeTerminated) return;
    if (this.currentSessionId === null) {
      this.pendingStdin.push(data);
      return;
    }
    try {
      this.client.emitStdin(this.currentSessionId, data);
    } catch {
      // 切断中: セッションはサーバ側で kill 済み
    }
  }

  kill(): void {
    if (this.activeRequestId === null || this.activeTerminated) return;
    if (this.currentSessionId === null) {
      this.pendingKill = true;
      return;
    }
    try {
      this.client.emitKill(this.currentSessionId);
    } catch {
      // 切断中: セッションはサーバ側で kill 済み
    }
  }

  dispose(): void {
    this.activeRequestId = null;
    this.pendingKill = false;
    this.pendingStdin = [];
    this.client.close();
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null
    ) => void
  ): void {
    this.statusCallback = callback;
  }

  onCompileErrors(callback: (errors: NospaceErrorEntry[]) => void): void {
    this.compileErrorsCallback = callback;
  }

  onConnectionChange(callback: (state: ConnectionState) => void): void {
    this.connectionCallback = callback;
  }

  /** ステータス変更時にシステムメッセージを出力する */

  private emitSystemMessage(
    status: ExecutionStatus,
    exitCode?: number | null
  ): void {
    let systemMessage: string | null = null;
    if (status === 'running') {
      systemMessage = `[Process started: ${this.currentSessionId}]\n`;
    } else if (status === 'finished') {
      systemMessage = `\n[Process exited with code: ${exitCode ?? 'unknown'}]\n`;
    } else if (status === 'killed') {
      systemMessage = `\n[Process killed]\n`;
    } else if (status === 'error') {
      systemMessage = `\n[Process error]\n`;
    }
    if (systemMessage) {
      this.outputCallback?.({
        type: 'system',
        data: systemMessage,
        timestamp: Date.now(),
      });
    }
  }
}
