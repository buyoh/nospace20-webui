// Unit test for ServerExecutionBackend

import { ServerExecutionBackend } from '../../web/services/ServerExecutionBackend';
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
} {
  const listeners: Record<string, (...args: any[]) => any> = {};
  const socket = {
    id: 'mock-socket-id',
    connected: false,
    on: (event: string, handler: (...args: any[]) => any) => {
      listeners[event] = handler;
    },
    removeAllListeners: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
  } as unknown as AppSocket;
  return { socket, listeners };
}

/** Fake Socket を接続済みにするヘルパー */
async function connectBackend(
  backend: ServerExecutionBackend,
  socket: AppSocket,
  listeners: Record<string, (...args: any[]) => any>
): Promise<void> {
  const initPromise = backend.init();
  (socket as any).connected = true;
  listeners['connect']();
  await initPromise;
}

/** 接続し、最初の実行要求（requestId: 'req-1'）を開始するヘルパー */
async function connectAndStart(
  backend: ServerExecutionBackend,
  socket: AppSocket,
  listeners: Record<string, (...args: any[]) => any>
): Promise<void> {
  await connectBackend(backend, socket, listeners);
  backend.run('code', {
    language: 'standard',
    debug: false,
    inputMode: 'batch',
  });
}

describe('ServerExecutionBackend', () => {
  let backend: ServerExecutionBackend;
  let fakeSocket: AppSocket;
  let listeners: Record<string, (...args: any[]) => any>;

  beforeEach(() => {
    const fake = createFakeSocket();
    fakeSocket = fake.socket;
    listeners = fake.listeners;
    let idCounter = 0;
    backend = new ServerExecutionBackend(
      () => fakeSocket,
      () => `req-${++idCounter}`
    );
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
        inputMode: 'batch' as const,
      };
      const stdinData = 'input data';

      backend.run(code, options, stdinData);

      expect((fakeSocket as any).emit).toHaveBeenCalledWith('nospace_run', {
        requestId: 'req-1',
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
          inputMode: 'batch',
        });
      }).toThrow('Socket not connected');
    });
  });

  describe('compile', () => {
    it('compile でクライアントの emitCompile を呼び出す', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      const code = 'nospace source';
      const options = { language: 'standard' as const, target: 'ws' as const };

      backend.compile(code, options);

      expect((fakeSocket as any).emit).toHaveBeenCalledWith('nospace_compile', {
        requestId: 'req-1',
        code,
        options,
      });
    });

    it('compile がエラーをスローしない', async () => {
      await connectBackend(backend, fakeSocket, listeners);

      expect(() => {
        backend.compile('code', { language: 'standard', target: 'ws' });
      }).not.toThrow();
    });

    it('capabilities.supportsCompile が true', () => {
      expect(ServerExecutionBackend.capabilities.supportsCompile).toBe(true);
    });

    it('stderr の JSON エラーで compileErrorsCallback が呼ばれる', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const compileErrorsCallback = jest.fn();
      backend.onCompileErrors(compileErrorsCallback);

      const errorJson = JSON.stringify({
        success: false,
        errors: [{ message: 'undefined function: foo', line: 3, column: 1 }],
      });

      listeners['nospace_stderr']({
        requestId: 'req-1',
        sessionId: 'test-session',
        data: errorJson,
      });

      expect(compileErrorsCallback).toHaveBeenCalledWith([
        { message: 'undefined function: foo', line: 3, column: 1 },
      ]);
    });

    it('stderr の非 JSON データで compileErrorsCallback が呼ばれない', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const compileErrorsCallback = jest.fn();
      backend.onCompileErrors(compileErrorsCallback);

      listeners['nospace_stderr']({
        requestId: 'req-1',
        sessionId: 'test-session',
        data: 'plain error text',
      });

      expect(compileErrorsCallback).not.toHaveBeenCalled();
    });
  });

  describe('sendStdin', () => {
    it('should emit nospace_stdin', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      // Simulate session start via execution_status event
      listeners['nospace_execution_status']({
        requestId: 'req-1',
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
      await connectAndStart(backend, fakeSocket, listeners);

      // Simulate session start
      listeners['nospace_execution_status']({
        requestId: 'req-1',
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
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      // Trigger stdout event
      listeners['nospace_stdout']({
        requestId: 'req-1',
        sessionId: 's1',
        data: 'output data',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stdout',
          data: 'output data',
        })
      );
    });

    it('should call output callback on nospace_stderr', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_stderr']({
        requestId: 'req-1',
        sessionId: 's1',
        data: 'error data',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stderr',
          data: 'error data',
        })
      );
    });

    it('should format nospace error JSON in stderr', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      const errorJson =
        '{"success":false,"errors":[{"message":"undefined function: sdf__puti"}]}';
      listeners['nospace_stderr']({
        requestId: 'req-1',
        sessionId: 's1',
        data: errorJson,
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stderr',
          data: 'undefined function: sdf__puti',
        })
      );
    });

    it('should format nospace error JSON with location info in stderr', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      const errorJson = JSON.stringify({
        success: false,
        errors: [{ message: 'syntax error', line: 5, column: 3 }],
      });
      listeners['nospace_stderr']({
        requestId: 'req-1',
        sessionId: 's1',
        data: errorJson,
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stderr',
          data: 'syntax error:5:3',
        })
      );
    });

    it('should call status callback on nospace_execution_status', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const statusCallback = jest.fn();
      backend.onStatusChange(statusCallback);

      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'test-session',
        status: 'running',
      });

      expect(statusCallback).toHaveBeenCalledWith(
        'running',
        'test-session',
        undefined
      );
    });

    it('should emit system message on status change to running', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'test-session',
        status: 'running',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process started'),
        })
      );
    });

    it('should emit system message on status change to finished', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'test-session',
        status: 'finished',
        exitCode: 0,
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process exited with code'),
        })
      );
    });

    it('should emit system message on status change to killed', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'test-session',
        status: 'killed',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process killed'),
        })
      );
    });

    it('should emit system message on status change to error', async () => {
      await connectAndStart(backend, fakeSocket, listeners);

      const outputCallback = jest.fn();
      backend.onOutput(outputCallback);

      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'test-session',
        status: 'error',
      });

      expect(outputCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system',
          data: expect.stringContaining('Process error'),
        })
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

  describe('要求の対応付け（requestId）', () => {
    const runOptions = {
      language: 'standard' as const,
      debug: false,
      inputMode: 'interactive' as const,
    };

    it('BUG: 旧要求のイベントは破棄され、新しい実行の状態・出力に混入しない', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      const statuses: string[] = [];
      const outputs: string[] = [];
      backend.onStatusChange((status) => statuses.push(status));
      backend.onOutput((e) => outputs.push(e.data));

      backend.run('a', runOptions); // req-1
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'old',
        status: 'running',
      });
      backend.run('b', runOptions); // req-2（旧セッションは kill される）
      listeners['nospace_execution_status']({
        requestId: 'req-2',
        sessionId: 'new',
        status: 'running',
      });
      // 旧セッションの終了通知と遅延した出力が後から届く
      listeners['nospace_stdout']({
        requestId: 'req-1',
        sessionId: 'old',
        data: 'stale',
      });
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 'old',
        status: 'killed',
      });

      expect(statuses).toEqual(['running', 'running']);
      expect(outputs.join('')).not.toContain('stale');
      expect(outputs.join('')).not.toContain('killed');
      // kill / stdin は新しいセッションに向く
      backend.kill();
      expect((fakeSocket as any).emit).toHaveBeenLastCalledWith(
        'nospace_kill',
        {
          sessionId: 'new',
        }
      );
    });

    it('終端ステータスの後に届く同じ要求の重複イベント（killed の二重通知など）は無視する', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      const statuses: string[] = [];
      backend.onStatusChange((status) => statuses.push(status));
      backend.run('a', runOptions);

      for (const status of ['running', 'killed', 'killed']) {
        listeners['nospace_execution_status']({
          requestId: 'req-1',
          sessionId: 's',
          status,
        });
      }

      expect(statuses).toEqual(['running', 'killed']);
    });

    it('終端ステータス後の kill / sendStdin はサーバへ送らない', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      backend.run('a', runOptions);
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 's',
        status: 'running',
      });
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 's',
        status: 'finished',
        exitCode: 0,
      });
      (fakeSocket as any).emit.mockClear();

      backend.kill();
      backend.sendStdin('x');

      expect((fakeSocket as any).emit).not.toHaveBeenCalled();
    });

    it('実行要求の前に届いたイベントは無視する', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      const outputs: string[] = [];
      backend.onOutput((e) => outputs.push(e.data));

      listeners['nospace_stdout']({
        requestId: 'req-1',
        sessionId: 's',
        data: 'x',
      });

      expect(outputs).toEqual([]);
    });

    it('sessionId 確定前の kill は、running 受信時に送信される', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      backend.run('a', runOptions);
      (fakeSocket as any).emit.mockClear();

      backend.kill();
      expect((fakeSocket as any).emit).not.toHaveBeenCalled();

      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 's',
        status: 'running',
      });

      expect((fakeSocket as any).emit).toHaveBeenCalledWith('nospace_kill', {
        sessionId: 's',
      });
    });

    it('sessionId 確定前の stdin は、running 受信時に順に送信される', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      backend.run('a', runOptions);
      (fakeSocket as any).emit.mockClear();

      backend.sendStdin('1\n');
      backend.sendStdin('2\n');
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 's',
        status: 'running',
      });

      const stdinCalls = (fakeSocket as any).emit.mock.calls.filter(
        (c: any[]) => c[0] === 'nospace_stdin'
      );
      expect(stdinCalls.map((c: any[]) => c[1].data)).toEqual(['1\n', '2\n']);
    });

    it('run が未接続で失敗した場合、以後のイベントを受け付けない', () => {
      expect(() => backend.run('a', runOptions)).toThrow(
        'Socket not connected'
      );
      const outputs: string[] = [];
      backend.onOutput((e) => outputs.push(e.data));

      listeners['nospace_stdout']?.({
        requestId: 'req-1',
        sessionId: 's',
        data: 'x',
      });

      expect(outputs).toEqual([]);
    });
  });

  describe('切断・再接続', () => {
    const runOptions = {
      language: 'standard' as const,
      debug: false,
      inputMode: 'interactive' as const,
    };

    it('BUG: 実行中に切断されたら error ステータスと切断メッセージを 1 回通知し、以後の旧イベントは無視する', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      const statuses: Array<[string, string]> = [];
      const outputs: string[] = [];
      backend.onStatusChange((status, sessionId) =>
        statuses.push([status, sessionId])
      );
      backend.onOutput((e) => outputs.push(e.data));
      backend.run('a', runOptions);
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 's',
        status: 'running',
      });

      listeners['disconnect']('transport close');
      listeners['nospace_execution_status']({
        requestId: 'req-1',
        sessionId: 's',
        status: 'killed',
      });

      expect(statuses).toEqual([
        ['running', 's'],
        ['error', 's'],
      ]);
      expect(outputs.filter((o) => o.includes('Connection lost'))).toHaveLength(
        1
      );
    });

    it('実行中でなければ切断しても status を通知せず、接続状態のみ通知する', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      const statuses: string[] = [];
      const states: string[] = [];
      backend.onStatusChange((status) => statuses.push(status));
      backend.onConnectionChange((state) => states.push(state));

      listeners['disconnect']('transport close');
      listeners['connect']();

      expect(statuses).toEqual([]);
      expect(states).toEqual(['reconnecting', 'connected']);
    });

    it('サーバ側からの意図的な切断は lost として通知する', async () => {
      await connectBackend(backend, fakeSocket, listeners);
      const states: string[] = [];
      backend.onConnectionChange((state) => states.push(state));

      listeners['disconnect']('io server disconnect');

      expect(states).toEqual(['lost']);
    });
  });
});
