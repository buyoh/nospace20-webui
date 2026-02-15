// Unit test for ServerExecutionBackend

import { ServerExecutionBackend } from '../../web/services/ServerExecutionBackend';
import type { ExecutionStatus, OutputEntry } from '../../interfaces/NospaceTypes';
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

/** Fake Socket を接続済みにするヘルパー */
async function connectBackend(
  backend: ServerExecutionBackend,
  socket: AppSocket,
  listeners: Record<string, Function>,
): Promise<void> {
  const initPromise = backend.init();
  (socket as any).connected = true;
  listeners['connect']();
  await initPromise;
}

describe('ServerExecutionBackend', () => {
  let backend: ServerExecutionBackend;
  let fakeSocket: AppSocket;
  let listeners: Record<string, Function>;

  beforeEach(() => {
    const fake = createFakeSocket();
    fakeSocket = fake.socket;
    listeners = fake.listeners;
    backend = new ServerExecutionBackend(() => fakeSocket);
  });

  afterEach(() => {
    backend.dispose();
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize socket connection', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      expect(backend.isReady()).toBe(true);
    });

    it('should reject on connection error', async () => {
      const initPromise = backend.init();

      const mockError = new Error('Connection failed');
      listeners['connect_error'](mockError);

      await expect(initPromise).rejects.toThrow('Connection failed');
    });

    it('should timeout if connection takes too long', async () => {
      const initPromise = backend.init();

      // Don't trigger connect event, let it timeout
      await expect(initPromise).rejects.toThrow('timeout');
    }, 15000);
  });

  describe('run', () => {
    it('should emit nospace_run with correct payload', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const code = 'nospace code';
      const options = {
        language: 'standard' as const,
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch' as const,
      };
      const stdinData = 'input data';

      backend.run(code, options, stdinData);

      expect((fakeSocket as any).emit).toHaveBeenCalledWith('nospace_run', {
        code,
        options,
        stdinData,
      });
    });

    it('should throw if not initialized', () => {
      expect(() => {
        backend.run('code', {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'batch',
        });
      }).toThrow('Socket not connected');
    });
  });

  describe('compile', () => {
    it('should throw not supported error', () => {
      expect(() => {
        backend.compile('code', { language: 'standard', target: 'ws' });
      }).toThrow('Compile not supported');
    });
  });

  describe('sendStdin', () => {
    it('should emit nospace_stdin', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      // Simulate session start via execution_status event
      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'running',
      });

      backend.sendStdin('input\n');

      expect((fakeSocket as any).emit).toHaveBeenCalledWith('nospace_stdin', {
        sessionId: 'test-session',
        data: 'input\n',
      });
    });
  });

  describe('kill', () => {
    it('should emit nospace_kill', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      // Simulate session start
      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'running',
      });

      backend.kill();

      expect((fakeSocket as any).emit).toHaveBeenCalledWith('nospace_kill', {
        sessionId: 'test-session',
      });
    });
  });

  describe('event callbacks', () => {
    it('should call output callback on nospace_stdout', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      // Trigger stdout event
      listeners['nospace_stdout']({ sessionId: 's1', data: 'output data' });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stdout',
          data: 'output data',
        }),
      );
    });

    it('should call output callback on nospace_stderr', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_stderr']({ sessionId: 's1', data: 'error data' });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stderr',
          data: 'error data',
        }),
      );
    });

    it('should format nospace error JSON in stderr', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      const errorJson =
        '{"success":false,"errors":[{"message":"undefined function: sdf__puti"}]}';
      listeners['nospace_stderr']({ sessionId: 's1', data: errorJson });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stderr',
          data: 'undefined function: sdf__puti',
        }),
      );
    });

    it('should format nospace error JSON with location info in stderr', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      const errorJson = JSON.stringify({
        success: false,
        errors: [{ message: 'syntax error', line: 5, column: 3 }],
      });
      listeners['nospace_stderr']({ sessionId: 's1', data: errorJson });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stderr',
          data: 'syntax error:5:3',
        }),
      );
    });

    it('should call status callback on nospace_execution_status', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const statusCallback = jest.fn();
      backend.onStatusChange(statusCallback);

      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'running',
      });

      expect(statusCallback).toHaveBeenCalledWith(
        'running',
        'test-session',
        undefined,
      );
    });

    it('should emit system message on status change to running', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'running',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process started'),
        }),
      );
    });

    it('should emit system message on status change to finished', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'finished',
        exitCode: 0,
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process exited with code'),
        }),
      );
    });

    it('should emit system message on status change to killed', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'killed',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process killed'),
        }),
      );
    });

    it('should emit system message on status change to error', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        sessionId: 'test-session',
        status: 'error',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process error'),
        }),
      );
    });
  });

  describe('dispose', () => {
    it('should close socket', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      backend.dispose();

      expect((fakeSocket as any).close).toHaveBeenCalled();
      expect(backend.isReady()).toBe(false);
    });
  });
});
