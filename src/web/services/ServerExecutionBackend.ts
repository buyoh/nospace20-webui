// Server flavor execution backend using Socket.IO

import { io, Socket } from 'socket.io-client';
import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
} from '../../interfaces/NospaceTypes';
import type {
  ExecutionBackend,
  ExecutionBackendCapabilities,
} from './ExecutionBackend';

type AppSocket = Socket<
  NospaceServerToClientEvents,
  NospaceClientToServerEvents
>;

export class ServerExecutionBackend implements ExecutionBackend {
  readonly flavor = 'server' as const;

  private socket: AppSocket | null = null;
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
    supportsCompile: false, // Future implementation
    supportsIgnoreDebug: true,
    supportsLanguageSubsetForRun: true,
    requiresServer: true,
  };

  async init(): Promise<void> {
    this.socket = io();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket.IO connection timeout'));
      }, 10000);

      this.socket!.on('connect', () => {
        clearTimeout(timeout);
        console.log('[ServerExecutionBackend] Socket connected:', this.socket!.id);
        this.setupEventListeners();
        resolve();
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('[ServerExecutionBackend] Connection error:', error);
        reject(error);
      });
    });
  }

  isReady(): boolean {
    return this.socket?.connected ?? false;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    if (!this.socket) throw new Error('Not initialized');
    console.log('[ServerExecutionBackend] Emitting nospace_run', {
      codeLength: code.length,
      options,
      stdinDataLength: stdinData?.length ?? 0,
    });
    this.socket.emit('nospace_run', { code, options, stdinData });
  }

  compile(_code: string, _options: CompileOptions): void {
    throw new Error('Compile not supported in server flavor');
  }

  sendStdin(data: string): void {
    if (!this.socket || !this.currentSessionId) return;
    this.socket.emit('nospace_stdin', {
      sessionId: this.currentSessionId,
      data,
    });
  }

  kill(): void {
    if (!this.socket || !this.currentSessionId) return;
    this.socket.emit('nospace_kill', {
      sessionId: this.currentSessionId,
    });
  }

  dispose(): void {
    console.log('[ServerExecutionBackend] Disposing');
    this.socket?.close();
    this.socket = null;
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

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('nospace_stdout', (payload) => {
      this.outputCallback?.({
        type: 'stdout',
        data: payload.data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('nospace_stderr', (payload) => {
      this.outputCallback?.({
        type: 'stderr',
        data: payload.data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('nospace_execution_status', (payload) => {
      this.currentSessionId = payload.sessionId;
      this.statusCallback?.(payload.status, payload.sessionId, payload.exitCode);

      // Generate system messages
      let systemMessage: string | null = null;
      if (payload.status === 'running') {
        systemMessage = `[Process started: ${payload.sessionId}]\n`;
      } else if (payload.status === 'finished') {
        systemMessage = `\n[Process exited with code: ${payload.exitCode ?? 'unknown'}]\n`;
      } else if (payload.status === 'killed') {
        systemMessage = `\n[Process killed]\n`;
      } else if (payload.status === 'error') {
        systemMessage = `\n[Process error]\n`;
      }

      if (systemMessage) {
        this.outputCallback?.({
          type: 'system',
          data: systemMessage,
          timestamp: Date.now(),
        });
      }
    });
  }
}
