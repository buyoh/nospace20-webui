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
function createFakeSocket(): jest.Mocked<AppSocket> {
  return {
    id: 'mock-socket-id',
    connected: false,
    on: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
  } as any;
}

describe('ServerExecutionBackend', () => {
  let backend: ServerExecutionBackend;
  let mockSocket: jest.Mocked<AppSocket>;

  beforeEach(() => {
    // Create fake socket
    mockSocket = createFakeSocket();

    // Create backend with fake socket factory
    backend = new ServerExecutionBackend(() => mockSocket);
  });

  afterEach(() => {
    backend.dispose();
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize socket connection', async () => {
      const initPromise = backend.init();

      // Simulate connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      expect(connectHandler).toBeDefined();
      mockSocket.connected = true;
      connectHandler!();

      await initPromise;
      expect(backend.isReady()).toBe(true);
    });

    it('should reject on connection error', async () => {
      const initPromise = backend.init();

      // Simulate connect_error event
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error',
      )?.[1];
      expect(errorHandler).toBeDefined();
      const mockError = new Error('Connection failed');
      errorHandler!(mockError);

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
      // Setup connected state
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      // Run
      const code = 'nospace code';
      const options = {
        language: 'standard' as const,
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch' as const,
      };
      const stdinData = 'input data';

      backend.run(code, options, stdinData);

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_run', {
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
      }).toThrow('Not initialized');
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
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      // Simulate session start
      const statusHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'nospace_execution_status',
      )?.[1];
      statusHandler!({
        sessionId: 'test-session',
        status: 'running',
      });

      backend.sendStdin('input\n');

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_stdin', {
        sessionId: 'test-session',
        data: 'input\n',
      });
    });
  });

  describe('kill', () => {
    it('should emit nospace_kill', async () => {
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      // Simulate session start
      const statusHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'nospace_execution_status',
      )?.[1];
      statusHandler!({
        sessionId: 'test-session',
        status: 'running',
      });

      backend.kill();

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_kill', {
        sessionId: 'test-session',
      });
    });
  });

  describe('event callbacks', () => {
    it('should call output callback on nospace_stdout', async () => {
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      // Trigger stdout event
      const stdoutHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'nospace_stdout',
      )?.[1];
      stdoutHandler!({ data: 'output data' });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stdout',
          data: 'output data',
        }),
      );
    });

    it('should call status callback on nospace_execution_status', async () => {
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      const statusCallback = jest.fn();
      backend.onStatusChange(statusCallback);

      // Trigger status event
      const statusHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'nospace_execution_status',
      )?.[1];
      statusHandler!({
        sessionId: 'test-session',
        status: 'running',
      });

      expect(statusCallback).toHaveBeenCalledWith('running', 'test-session', undefined);
    });

    it('should emit system message on status change', async () => {
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      // Trigger status event
      const statusHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'nospace_execution_status',
      )?.[1];
      statusHandler!({
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
  });

  describe('dispose', () => {
    it('should close socket', async () => {
      mockSocket.connected = true;
      const initPromise = backend.init();
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect',
      )?.[1];
      connectHandler!();
      await initPromise;

      backend.dispose();

      expect(mockSocket.close).toHaveBeenCalled();
      expect(backend.isReady()).toBe(false);
    });
  });
});
