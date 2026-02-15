// Server flavor execution backend using Socket.IO

import { io } from 'socket.io-client';
import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';
import type {
  ExecutionBackend,
  ExecutionBackendCapabilities,
} from './ExecutionBackend';
import {
  NospaceSocketClient,
  type SocketFactory,
} from './NospaceSocketClient';
import { tryFormatNospaceErrorJson } from '../libs/formatNospaceErrors';

const defaultSocketFactory: SocketFactory = () => io();

/**
 * サーバー (Socket.IO) を使用した実行バックエンド。
 * NospaceSocketClient に接続管理を委譲し、ビジネスロジック
 * （OutputEntry 変換、システムメッセージ生成、セッション管理）のみを担当する。
 */
export class ServerExecutionBackend implements ExecutionBackend {
  readonly flavor = 'server' as const;

  private client: NospaceSocketClient;
  private currentSessionId: string | null = null;
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback:
    | ((
        status: ExecutionStatus,
        sessionId: string,
        exitCode?: number | null,
      ) => void)
    | null = null;

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: true,
    supportsCompile: false,
    supportsIgnoreDebug: true,
    supportsLanguageSubsetForRun: true,
    requiresServer: true,
  };

  constructor(socketFactory: SocketFactory = defaultSocketFactory) {
    this.client = new NospaceSocketClient(socketFactory);
  }

  async init(): Promise<void> {
    await this.client.connect({
      onStdout: (payload) => {
        this.outputCallback?.({
          type: 'stdout',
          data: payload.data,
          timestamp: Date.now(),
        });
      },
      onStderr: (payload) => {
        // BUG FIX: nospace バイナリがコンパイルエラー時に JSON を stderr に出力するため、
        // JSON をパースして整形されたメッセージに変換する。パースに失敗した場合はそのまま表示。
        const formatted = tryFormatNospaceErrorJson(payload.data);
        this.outputCallback?.({
          type: 'stderr',
          data: formatted ?? payload.data,
          timestamp: Date.now(),
        });
      },
      onExecutionStatus: (payload) => {
        this.currentSessionId = payload.sessionId;
        this.statusCallback?.(
          payload.status as ExecutionStatus,
          payload.sessionId,
          payload.exitCode,
        );
        this.emitSystemMessage(
          payload.status as ExecutionStatus,
          payload.exitCode,
        );
      },
    });
  }

  isReady(): boolean {
    return this.client.connected;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    this.client.emitRun(code, options, stdinData);
  }

  compile(_code: string, _options: CompileOptions): void {
    throw new Error('Compile not supported in server flavor');
  }

  sendStdin(data: string): void {
    if (!this.currentSessionId) return;
    this.client.emitStdin(this.currentSessionId, data);
  }

  kill(): void {
    if (!this.currentSessionId) return;
    this.client.emitKill(this.currentSessionId);
  }

  dispose(): void {
    this.client.close();
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null,
    ) => void,
  ): void {
    this.statusCallback = callback;
  }

  /** ステータス変更時にシステムメッセージを出力する */
  private emitSystemMessage(
    status: ExecutionStatus,
    exitCode?: number | null,
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
