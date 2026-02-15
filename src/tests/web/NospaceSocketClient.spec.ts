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
  listeners: Record<string, Function>;
} {
  const listeners: Record<string, Function> = {};
  const socket = {
    id: 'mock-socket-id',
    connected: false,
    on: (event: string, handler: Function) => {
      listeners[event] = handler;
    },
    emit: jest.fn(),
    close: jest.fn(),
  } as unknown as AppSocket;
  return { socket, listeners };
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
      await expect(connectPromise).rejects.toThrow('Socket.IO connection timeout');
    });

    it('should throw if socketFactory returns null', async () => {
      const client = new NospaceSocketClient(
        () => null as unknown as AppSocket,
      );
      const { handlers } = createMockHandlers();

      await expect(client.connect(handlers)).rejects.toThrow(
        'Failed to create Socket client',
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

      client.emitRun('code', options, 'stdin');

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_run', {
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

      client.emitRun('code', options);

      expect((socket as any).emit).toHaveBeenCalledWith('nospace_run', {
        code: 'code',
        options,
        stdinData: undefined,
      });
    });

    it('should throw if not connected', () => {
      const { socket } = createFakeSocket();
      const client = new NospaceSocketClient(() => socket);

      expect(() => {
        client.emitRun('code', {
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
});
