// Unit test for NospaceSocketClient

import { NospaceSocketClient } from '../../web/services/NospaceSocketClient';
import type { NospaceSocketEventHandlers } from '../../web/services/NospaceSocketClient';
import type { Socket } from 'socket.io-client';
import type {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
} from '../../interfaces/NospaceTypes';

type AppSocket = Socket<
  NospaceServerToClientEvents,
  NospaceClientToServerEvents
>;

/** テスト用の Fake Socket を作成 */
function createFakeSocket(): {
  socket: AppSocket;
  listeners: Record<string, (...args: any[]) => any>;
  /** イベントごとに登録されたハンドラ数（重複登録の検出用） */
  handlerCounts: Record<string, number>;
  /** 登録された全ハンドラを呼び出す（実際の socket.io と同様） */
  fire: (event: string, ...args: any[]) => void;
} {
  const listeners: Record<string, (...args: any[]) => any> = {};
  const all: Record<string, Array<(...args: any[]) => any>> = {};
  const handlerCounts: Record<string, number> = {};
  const socket = {
    id: 'mock-socket-id',
    connected: false,
    on: (event: string, handler: (...args: any[]) => any) => {
      listeners[event] = handler;
      (all[event] ??= []).push(handler);
      handlerCounts[event] = all[event].length;
    },
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
  } as unknown as AppSocket;
  const fire = (event: string, ...args: any[]) => {
    for (const h of all[event] ?? []) h(...args);
  };
  return { socket, listeners, handlerCounts, fire };
}

/** テスト用のイベントハンドラーを作成 */
function createMockHandlers(): {
  handlers: NospaceSocketEventHandlers;
  calls: {
    onStdout: any[];
    onStderr: any[];
    onExecutionStatus: any[];
  };
} {
  const calls = {
    onStdout: [] as any[],
    onStderr: [] as any[],
    onExecutionStatus: [] as any[],
  };
  const handlers: NospaceSocketEventHandlers = {
    onStdout: (payload) => calls.onStdout.push(payload),
    onStderr: (payload) => calls.onStderr.push(payload),
    onExecutionStatus: (payload) => calls.onExecutionStatus.push(payload),
  };
  return { handlers, calls };
}

describe('NospaceSocketClient', () => {
  describe('connect', () => {
    it('should create socket and resolve on connect event', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);

      // Simulate connect event
      (socket as any).connected = true;
      listeners['connect']();

      await connectPromise;
      expect(client.connected).toBe(true);
    });

    it('should register event listeners after connect', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers, calls } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      // Verify that nospace event listeners were registered
      expect(listeners['nospace_stdout']).toBeDefined();
      expect(listeners['nospace_stderr']).toBeDefined();
      expect(listeners['nospace_execution_status']).toBeDefined();

      // Verify they forward to handlers
      listeners['nospace_stdout']({ sessionId: 's1', data: 'hello' });
      expect(calls.onStdout).toEqual([{ sessionId: 's1', data: 'hello' }]);

      listeners['nospace_stderr']({ sessionId: 's1', data: 'err' });
      expect(calls.onStderr).toEqual([{ sessionId: 's1', data: 'err' }]);

      listeners['nospace_execution_status']({
        sessionId: 's1',
        status: 'running',
      });
      expect(calls.onExecutionStatus).toEqual([
        { sessionId: 's1', status: 'running' },
      ]);
    });

    it('should reject on connect_error', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);

      const mockError = new Error('Connection failed');
      listeners['connect_error'](mockError);

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });

    it('should reject on timeout', async () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers, 100);

      // Don't trigger connect event, let it timeout
      await expect(connectPromise).rejects.toThrow(
        'Socket.IO connection timeout'
      );
    });

    it('should throw if socketFactory returns null', async () => {
      const client = new NospaceSocketClient(
        () => null as unknown as AppSocket
      );
      const { handlers } = createMockHandlers();

      await expect(client.connect(handlers)).rejects.toThrow(
        'Failed to create Socket client'
      );
    });
  });

  describe('emitRun', () => {
    it('should emit nospace_run with correct payload', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      const options = {
        language: 'standard' as const,
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch' as const,
      };

      client.emitRun('req-1', 'code', options, 'stdin');

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_run', {
        requestId: 'req-1',
        code: 'code',
        options,
        stdinData: 'stdin',
      });
    });

    it('should emit nospace_run without stdinData when not provided', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      const options = {
        language: 'standard' as const,
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch' as const,
      };

      client.emitRun('req-1', 'code', options);

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_run', {
        requestId: 'req-1',
        code: 'code',
        options,
        stdinData: undefined,
      });
    });

    it('should throw if not connected', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      expect(() => {
        client.emitRun('req-1', 'code', {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'batch',
        });
      }).toThrow('Socket not connected');
    });
  });

  describe('emitStdin', () => {
    it('should emit nospace_stdin with correct payload', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      client.emitStdin('session-1', 'input\n');

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_stdin', {
        sessionId: 'session-1',
        data: 'input\n',
      });
    });

    it('should throw if not connected', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      expect(() => {
        client.emitStdin('session-1', 'data');
      }).toThrow('Socket not connected');
    });
  });

  describe('emitKill', () => {
    it('should emit nospace_kill with correct payload', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      client.emitKill('session-1');

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_kill', {
        sessionId: 'session-1',
      });
    });

    it('should throw if not connected', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      expect(() => {
        client.emitKill('session-1');
      }).toThrow('Socket not connected');
    });
  });

  describe('close', () => {
    it('should close socket and clear reference', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      client.close();

      expect((socket as any).close).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });

    it('should be safe to call when not connected', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      // Should not throw
      client.close();
      expect(client.connected).toBe(false);
    });
  });

  describe('emitCompile', () => {
    it('emitCompile でコンパイルリクエストを送信する', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      const code = 'nospace source';
      const options = { language: 'standard' as const, target: 'ws' as const };

      client.emitCompile('req-1', code, options);

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_compile', {
        requestId: 'req-1',
        code,
        options,
      });
    });

    it('should throw if not connected', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      expect(() => {
        client.emitCompile('req-1', 'code', {
          language: 'standard',
          target: 'ws',
        });
      }).toThrow('Socket not connected');
    });
  });

  describe('connected', () => {
    it('should return false when no socket exists', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      expect(client.connected).toBe(false);
    });

    it('should reflect socket.connected state', async () => {
      const { socket, listeners } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      const connectPromise = client.connect(handlers);
      (socket as any).connected = true;
      listeners['connect']();
      await connectPromise;

      expect(client.connected).toBe(true);

      (socket as any).connected = false;
      expect(client.connected).toBe(false);
    });
  });

  describe('再接続・切断', () => {
    /** 接続済みのクライアントと、通知を記録するハンドラを用意する */
    async function connectedClient() {
      const fake = createFakeSocket();
      const client = new NospaceSocketClient(() => fake.socket);
      const { handlers, calls } = createMockHandlers();
      const events: string[] = [];
      handlers.onDisconnect = (reason) => events.push(`disconnect:${reason}`);
      handlers.onReconnect = () => events.push('reconnect');
      const connectPromise = client.connect(handlers);
      (fake.socket as any).connected = true;
      fake.fire('connect');
      await connectPromise;
      return { ...fake, client, calls, events };
    }

    it('BUG: connect が複数回発火しても受信リスナーは重複登録されず、ハンドラは 1 回だけ呼ばれる', async () => {
      const { fire, handlerCounts, calls } = await connectedClient();

      fire('connect');
      fire('connect');
      fire('nospace_stdout', { requestId: 'r', sessionId: 's', data: 'x' });

      expect(handlerCounts['nospace_stdout']).toBe(1);
      expect(handlerCounts['nospace_stderr']).toBe(1);
      expect(handlerCounts['nospace_execution_status']).toBe(1);
      expect(calls.onStdout).toHaveLength(1);
    });

    it('初回の connect では onReconnect が呼ばれず、2 回目以降で呼ばれる', async () => {
      const { fire, events } = await connectedClient();
      expect(events).toEqual([]);

      fire('connect');

      expect(events).toEqual(['reconnect']);
    });

    it('初回接続後の disconnect で onDisconnect に reason が渡る', async () => {
      const { fire, events } = await connectedClient();

      fire('disconnect', 'transport close');
      fire('disconnect', 'io server disconnect');

      expect(events).toEqual([
        'disconnect:transport close',
        'disconnect:io server disconnect',
      ]);
    });

    it('初回接続前の disconnect は通知しない', async () => {
      const fake = createFakeSocket();
      const client = new NospaceSocketClient(() => fake.socket);
      const { handlers } = createMockHandlers();
      const events: string[] = [];
      handlers.onDisconnect = (r) => events.push(r);
      const p = client.connect(handlers, 50);

      fake.fire('disconnect', 'transport close');

      await expect(p).rejects.toThrow('timeout');
      expect(events).toEqual([]);
    });

    it('BUG: 初回接続のタイムアウトで socket を close する（バックグラウンド再接続を残さない）', async () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);
      const { handlers } = createMockHandlers();

      await expect(client.connect(handlers, 20)).rejects.toThrow('timeout');

      expect((socket as any).close).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });

    it('初回の connect_error で socket を close する', async () => {
      const fake = createFakeSocket();
      const client = new NospaceSocketClient(() => fake.socket);
      const { handlers } = createMockHandlers();
      const p = client.connect(handlers);

      fake.fire('connect_error', new Error('refused'));

      await expect(p).rejects.toThrow('refused');
      expect((fake.socket as any).close).toHaveBeenCalled();
    });

    it('初回接続後の connect_error は無視する（自動再接続に任せる）', async () => {
      const { fire, socket } = await connectedClient();

      fire('connect_error', new Error('flaky'));

      expect((socket as any).close).not.toHaveBeenCalled();
    });

    it('切断中（未接続）の emitRun / emitKill は送信せず例外を投げる', async () => {
      const { client, socket } = await connectedClient();
      (socket as any).connected = false;

      expect(() =>
        client.emitRun('r', 'code', {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'batch',
        })
      ).toThrow('Socket not connected');
      expect(() => client.emitKill('s')).toThrow('Socket not connected');
      expect((socket as any).emit).not.toHaveBeenCalled();
    });

    it('close は全リスナーを解除してから socket を閉じる', async () => {
      const { client, socket } = await connectedClient();

      client.close();

      expect((socket as any).removeAllListeners).toHaveBeenCalled();
      expect((socket as any).close).toHaveBeenCalled();
    });
  });
});
