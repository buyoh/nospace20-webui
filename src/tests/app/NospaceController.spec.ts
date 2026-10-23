import { NospaceController } from '../../app/Controllers/NospaceController';
import {
  NospaceExecutionService,
  NospaceSession,
} from '../../app/Services/NospaceExecutionService';
import { ExecutionLimitError } from '../../app/Services/ExecutionSlotLimiter';
import type { RunOptions, CompileOptions } from '../../interfaces/NospaceTypes';

// Fake Socket implementation
class FakeSocket {
  id: string;
  private eventHandlers: Map<string, (...args: any[]) => any> = new Map();
  emittedEvents: Array<{ event: string; payload: any }> = [];

  constructor(id: string = 'test-socket-id') {
    this.id = id;
  }

  on(event: string, handler: (...args: any[]) => any): void {
    this.eventHandlers.set(event, handler);
  }

  emit(event: string, payload: any): void {
    this.emittedEvents.push({ event, payload });
  }

  // Helper to trigger events
  trigger(event: string, payload?: any): void {
    const handler = this.eventHandlers.get(event);
    if (handler) {
      handler(payload);
    }
  }

  // Helper to get emitted events
  getEmittedEvents(eventName: string): any[] {
    return this.emittedEvents
      .filter((e) => e.event === eventName)
      .map((e) => e.payload);
  }
}

// Fake NospaceSession implementation
class FakeNospaceSession implements NospaceSession {
  sessionId: string;
  status: 'running' | 'finished' | 'error' | 'killed';
  exitCode: number | null;
  private stdinData: string[] = [];
  private killCalled = false;
  private stdinClosed = false;

  constructor(
    sessionId: string = 'test-session-id',
    status: 'running' | 'finished' | 'error' | 'killed' = 'running',
    exitCode: number | null = null
  ) {
    this.sessionId = sessionId;
    this.status = status;
    this.exitCode = exitCode;
  }

  kill(): void {
    this.killCalled = true;
    this.status = 'killed';
  }

  sendStdin(data: string): void {
    this.stdinData.push(data);
  }

  closeStdin(): void {
    this.stdinClosed = true;
  }

  wasStdinClosed(): boolean {
    return this.stdinClosed;
  }

  // Test helpers
  getStdinData(): string[] {
    return this.stdinData;
  }

  wasKillCalled(): boolean {
    return this.killCalled;
  }
}

// Fake NospaceExecutionService implementation
class FakeNospaceExecutionService extends NospaceExecutionService {
  private fakeSessions = new Map<string, FakeNospaceSession>();
  private runCalls: Array<{
    code: string;
    options: RunOptions;
    callbacks: any;
    flowControl?: any;
  }> = [];
  private compileCalls: Array<{
    code: string;
    options: CompileOptions;
    callbacks: any;
  }> = [];
  private removedSessionIds: string[] = [];
  private sessionCounter = 0;
  /** 次の run/compile で throw するエラー */
  public throwOnStart: Error | null = null;
  /** run/compile 内（戻り値を返す前）にコールバックを同期的に呼ぶための差し込み口 */
  public onStart:
    | ((session: FakeNospaceSession, callbacks: any) => void)
    | null = null;

  // Override to skip constructor dependencies
  constructor() {
    // Call parent constructor with dummy values
    super(
      {
        nospaceBinPath: '/dummy/path',
        whitespaceBinPath: '/dummy/path',
        nospaceTimeout: 10000,
        nospaceMaxProcesses: 5,
      },
      {
        existsSync: () => false,
        writeFileSync: () => {},
        unlinkSync: () => {},
        mkdirSync: () => {},
      },
      { spawn: () => null as any }
    );
  }

  private startFake(callbacks: any): FakeNospaceSession {
    if (this.throwOnStart) throw this.throwOnStart;
    const session = new FakeNospaceSession(`session-${++this.sessionCounter}`);
    this.fakeSessions.set(session.sessionId, session);
    this.onStart?.(session, callbacks);
    return session;
  }

  run(
    code: string,
    options: RunOptions,
    callbacks: any,
    flowControl?: any
  ): NospaceSession {
    const session = this.startFake(callbacks);
    this.runCalls.push({ code, options, callbacks, flowControl });
    return session;
  }

  compile(
    code: string,
    options: CompileOptions,
    callbacks: any
  ): NospaceSession {
    const session = this.startFake(callbacks);
    this.compileCalls.push({ code, options, callbacks });
    return session;
  }

  getSession(sessionId: string): NospaceSession | undefined {
    return this.fakeSessions.get(sessionId);
  }

  removeSession(sessionId: string): void {
    this.fakeSessions.delete(sessionId);
    this.removedSessionIds.push(sessionId);
  }

  // Test helpers
  getRunCalls() {
    return this.runCalls;
  }

  getCompileCalls() {
    return this.compileCalls;
  }

  getRemovedSessionIds(): string[] {
    return this.removedSessionIds;
  }

  // Helper to add a pre-existing session to the fake service
  addSession(session: FakeNospaceSession): void {
    this.fakeSessions.set(session.sessionId, session);
  }

  // Helper to get all session IDs
  getSessionIds(): string[] {
    return Array.from(this.fakeSessions.keys());
  }
}

describe('NospaceController', () => {
  let controller: NospaceController;
  let executionService: FakeNospaceExecutionService;
  let socket: FakeSocket;

  beforeEach(() => {
    executionService = new FakeNospaceExecutionService();
    controller = new NospaceController(executionService as any);
    socket = new FakeSocket();
  });

  describe('handleConnection', () => {
    it('should register event handlers on socket', () => {
      controller.handleConnection(socket as any);

      // Verify handlers are registered
      expect(socket['eventHandlers'].has('nospace_run')).toBe(true);
      expect(socket['eventHandlers'].has('nospace_compile')).toBe(true);
      expect(socket['eventHandlers'].has('nospace_stdin')).toBe(true);
      expect(socket['eventHandlers'].has('nospace_kill')).toBe(true);
      expect(socket['eventHandlers'].has('disconnect')).toBe(true);
    });
  });

  describe('handleRun', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should call executionService.run with correct arguments', () => {
      const code = 'test code';
      const options: RunOptions = {
        language: 'standard',
        inputMode: 'interactive',
        debug: false,
      };

      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code,
        options,
      });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].code).toBe(code);
      // 検証・正規化された options が渡される（未指定のリストは空配列になる）
      expect(calls[0].options).toEqual({
        ...options,
        strictHeap: false,
        randomizeHeap: false,
        stdExtensions: [],
        optPasses: [],
      });
    });

    it('should emit running status after creating session', () => {
      const code = 'test code';
      const options: RunOptions = {
        language: 'standard',
        inputMode: 'interactive',
        debug: false,
      };

      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code,
        options,
      });

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0].status).toBe('running');
    });

    it('should kill and remove existing session before creating new one', () => {
      // First run
      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code: 'first',
        options: {
          language: 'standard',
          inputMode: 'interactive',
          debug: false,
        },
      });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);
      const firstSessionId = executionService.getSessionIds()[0];

      // Second run (should kill first session)
      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code: 'second',
        options: {
          language: 'standard',
          inputMode: 'interactive',
          debug: false,
        },
      });

      expect(calls).toHaveLength(2);

      // First session should have been removed
      const removedIds = executionService.getRemovedSessionIds();
      expect(removedIds).toContain(firstSessionId);
    });

    it('BUG: batch モードでは stdin を書き込んだ後に閉じる（EOF を待つプログラムがタイムアウトまで待たない）', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-b',
        code: 'c',
        options: {
          language: 'standard',
          inputMode: 'batch',
          debug: false,
        },
        stdinData: 'input data',
      });

      const session = executionService.getSession(
        executionService.getSessionIds()[0]
      ) as FakeNospaceSession;
      expect(session.getStdinData()).toEqual(['input data']);
      expect(session.wasStdinClosed()).toBe(true);
    });

    it('batch モードで stdinData が無くても stdin を閉じる', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-b',
        code: 'c',
        options: {
          language: 'standard',
          inputMode: 'batch',
          debug: false,
        },
      });

      const session = executionService.getSession(
        executionService.getSessionIds()[0]
      ) as FakeNospaceSession;
      expect(session.getStdinData()).toEqual([]);
      expect(session.wasStdinClosed()).toBe(true);
    });

    it('interactive モードでは stdin を閉じない', () => {
      const session = startRun();

      expect(session.wasStdinClosed()).toBe(false);
    });

    it('should send stdin data in batch mode', () => {
      const code = 'test code';
      const options: RunOptions = {
        language: 'standard',
        inputMode: 'batch',
        debug: false,
      };
      const stdinData = 'input data';

      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code,
        options,
        stdinData,
      });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);

      // Get the session that was created
      // Can't easily verify sendStdin was called here without refactoring
      // This is a limitation of the test design
    });
  });

  /** run を発行して、サービスが作った（このソケット所有の）セッションを返す */
  function startRun(
    requestId = 'req-1',
    extra: Record<string, unknown> = {}
  ): FakeNospaceSession {
    socket.trigger('nospace_run', {
      requestId,
      code: 'test',
      options: {
        language: 'standard',
        inputMode: 'interactive',
        debug: false,
      },
      ...extra,
    });
    const ids = executionService.getSessionIds();
    return executionService.getSession(
      ids[ids.length - 1]
    ) as FakeNospaceSession;
  }

  describe('handleStdinInput', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should send stdin data with newline appended', () => {
      const session = startRun();

      socket.trigger('nospace_stdin', {
        sessionId: session.sessionId,
        data: 'input data',
      });

      const stdinData = session.getStdinData();
      expect(stdinData).toHaveLength(1);
      expect(stdinData[0]).toBe('input data\n');
    });

    it('should not add extra newline if data already ends with newline', () => {
      const session = startRun();

      socket.trigger('nospace_stdin', {
        sessionId: session.sessionId,
        data: 'input data\n',
      });

      const stdinData = session.getStdinData();
      expect(stdinData).toHaveLength(1);
      expect(stdinData[0]).toBe('input data\n');
    });

    it('should not send stdin if session is not running', () => {
      const session = startRun();
      session.status = 'finished';

      socket.trigger('nospace_stdin', {
        sessionId: session.sessionId,
        data: 'input data',
      });

      expect(session.getStdinData()).toHaveLength(0);
    });

    it('should ignore stdin for a session owned by another socket', () => {
      const otherSocket = new FakeSocket('other-socket');
      controller.handleConnection(otherSocket as any);
      const session = startRun();

      otherSocket.trigger('nospace_stdin', {
        sessionId: session.sessionId,
        data: 'hijack',
      });

      expect(session.getStdinData()).toHaveLength(0);
    });

    it('should ignore stdin payload with invalid types without throwing', () => {
      startRun();

      expect(() => {
        socket.trigger('nospace_stdin', { sessionId: 1, data: {} });
        socket.trigger('nospace_stdin', undefined);
      }).not.toThrow();
    });
  });

  describe('handleKill', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should kill session and emit killed status with the request id', () => {
      const session = startRun('req-kill');
      socket.emittedEvents = [];

      socket.trigger('nospace_kill', { sessionId: session.sessionId });

      expect(session.wasKillCalled()).toBe(true);

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0].requestId).toBe('req-kill');
      expect(statusEvents[0].sessionId).toBe(session.sessionId);
      expect(statusEvents[0].status).toBe('killed');
      expect(statusEvents[0].exitCode).toBe(null);
    });

    it('should do nothing if session does not exist', () => {
      socket.trigger('nospace_kill', { sessionId: 'nonexistent-session' });

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(0);
    });

    it('should not kill a session owned by another socket', () => {
      const otherSocket = new FakeSocket('other-socket');
      controller.handleConnection(otherSocket as any);
      const session = startRun();

      otherSocket.trigger('nospace_kill', { sessionId: session.sessionId });

      expect(session.wasKillCalled()).toBe(false);
    });
  });

  describe('handleDisconnect', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should kill and remove session on disconnect', () => {
      // Create a session
      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code: 'test',
        options: {
          language: 'standard',
          inputMode: 'interactive',
          debug: false,
        },
      });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);

      // Get the session ID
      const sessionId = executionService.getSessionIds()[0];
      const createdSession = executionService.getSession(
        sessionId
      ) as FakeNospaceSession;

      expect(createdSession).toBeDefined();

      // Disconnect
      socket.trigger('disconnect');

      expect(createdSession.wasKillCalled()).toBe(true);

      const removedIds = executionService.getRemovedSessionIds();
      expect(removedIds).toContain(createdSession.sessionId);
    });

    it('should do nothing if no session exists', () => {
      socket.trigger('disconnect');

      const removedIds = executionService.getRemovedSessionIds();
      expect(removedIds).toHaveLength(0);
    });
  });

  describe('onExit callback', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should emit execution status and remove session on exit', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-1',
        code: 'test',
        options: {
          language: 'standard',
          inputMode: 'interactive',
          debug: false,
        },
      });

      const calls = executionService.getRunCalls();
      const exitCallback = calls[0].callbacks.onExit;
      const sessionId = executionService.getSessionIds()[0];

      // Simulate exit
      exitCallback(sessionId, 'finished', 0);

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      // First event is from run, second is from onExit
      expect(statusEvents.length).toBeGreaterThanOrEqual(1);

      // Check that session was removed
      const removedIds = executionService.getRemovedSessionIds();
      expect(removedIds.length).toBeGreaterThan(0);
    });
  });

  describe('handleCompile', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('nospace_compile イベントで compile を呼ぶ', () => {
      const code = 'nospace code';
      const options: CompileOptions = {
        language: 'standard',
        target: 'ws',
      };

      socket.trigger('nospace_compile', {
        requestId: 'req-1',
        code,
        options,
      });

      const calls = executionService.getCompileCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].code).toBe(code);
      expect(calls[0].options).toEqual({
        ...options,
        stdExtensions: [],
        optPasses: [],
      });
    });

    it('compile の初回ステータスが compiling である', () => {
      socket.trigger('nospace_compile', {
        requestId: 'req-1',
        code: 'test',
        options: { language: 'standard', target: 'ws' },
      });

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0].status).toBe('compiling');
      expect(statusEvents[0].exitCode).toBe(null);
    });

    it('compile 中に disconnect で kill される', () => {
      socket.trigger('nospace_compile', {
        requestId: 'req-1',
        code: 'test',
        options: { language: 'standard', target: 'ws' },
      });

      const sessionId = executionService.getSessionIds()[0];
      const session = executionService.getSession(
        sessionId
      ) as FakeNospaceSession;

      socket.trigger('disconnect');

      expect(session.wasKillCalled()).toBe(true);
    });

    it('compile 中に新しい compile リクエストで既存セッションが kill される', () => {
      // First compile
      socket.trigger('nospace_compile', {
        requestId: 'req-1',
        code: 'first',
        options: { language: 'standard', target: 'ws' },
      });

      const firstSessionId = executionService.getSessionIds()[0];
      const firstSession = executionService.getSession(
        firstSessionId
      ) as FakeNospaceSession;

      // Second compile
      socket.trigger('nospace_compile', {
        requestId: 'req-1',
        code: 'second',
        options: { language: 'min', target: 'mnemonic' },
      });

      expect(firstSession.wasKillCalled()).toBe(true);
      expect(executionService.getCompileCalls()).toHaveLength(2);
    });
  });

  describe('requestId とエラー耐性', () => {
    const runOptions = {
      language: 'standard',
      inputMode: 'interactive',
      debug: false,
    };

    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('全てのイベントに要求の requestId が付く', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-x',
        code: 'c',
        options: runOptions,
      });
      const cb = executionService.getRunCalls()[0].callbacks;
      const sessionId = executionService.getSessionIds()[0];
      cb.onStdout(sessionId, 'out');
      cb.onStderr(sessionId, 'err');
      cb.onExit(sessionId, 'finished', 0);

      for (const e of socket.emittedEvents) {
        expect(e.payload.requestId).toBe('req-x');
      }
      expect(socket.emittedEvents).toHaveLength(4);
    });

    it('BUG: onExit が run() の戻り前に同期で呼ばれても例外を出さず、running を通知せず、登録しない', () => {
      executionService.onStart = (session, cb) => {
        session.status = 'error';
        cb.onStderr(session.sessionId, 'boom\n');
        cb.onExit(session.sessionId, 'error', 1);
      };

      expect(() =>
        socket.trigger('nospace_run', {
          requestId: 'req-sync',
          code: 'c',
          options: runOptions,
        })
      ).not.toThrow();

      const statuses = socket.getEmittedEvents('nospace_execution_status');
      expect(statuses.map((e) => e.status)).toEqual(['error']);
      expect(statuses[0].requestId).toBe('req-sync');

      // 登録されていないため、切断しても kill 対象にならない
      const session = executionService.getRemovedSessionIds();
      socket.trigger('disconnect');
      expect(executionService.getRemovedSessionIds()).toEqual(session);
    });

    it('BUG: compile の onExit が同期で呼ばれても compiling を通知しない', () => {
      executionService.onStart = (session, cb) => {
        session.status = 'error';
        cb.onExit(session.sessionId, 'error', 1);
      };

      socket.trigger('nospace_compile', {
        requestId: 'req-c',
        code: 'c',
        options: { language: 'standard', target: 'ex-ws' },
      });

      const statuses = socket.getEmittedEvents('nospace_execution_status');
      expect(statuses.map((e) => e.status)).toEqual(['error']);
    });

    it('サービスが想定外の例外を投げても外へ出さず、要求のエラーとして通知する', () => {
      executionService.throwOnStart = new Error('disk failure');

      expect(() =>
        socket.trigger('nospace_run', {
          requestId: 'req-t',
          code: 'c',
          options: runOptions,
        })
      ).not.toThrow();

      const statuses = socket.getEmittedEvents('nospace_execution_status');
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toMatchObject({
        requestId: 'req-t',
        status: 'error',
      });
    });

    it('同時実行数の上限に達した場合は busy のエラーを requestId 付きで通知する', () => {
      executionService.throwOnStart = new ExecutionLimitError();

      socket.trigger('nospace_run', {
        requestId: 'req-l',
        code: 'c',
        options: runOptions,
      });
      socket.trigger('nospace_compile', {
        requestId: 'req-l2',
        code: 'c',
        options: { language: 'standard', target: 'ws' },
      });

      const stderrs = socket.getEmittedEvents('nospace_stderr');
      expect(stderrs.map((e) => e.requestId)).toEqual(['req-l', 'req-l2']);
      expect(stderrs[0].data).toContain('busy');
      const statuses = socket.getEmittedEvents('nospace_execution_status');
      expect(statuses.map((e) => e.status)).toEqual(['error', 'error']);
    });

    it('終了処理中の拒否は、サービスが持つ理由をそのまま通知する', () => {
      executionService.throwOnStart = new ExecutionLimitError(
        'Server is shutting down.'
      );

      socket.trigger('nospace_run', {
        requestId: 'req-s',
        code: 'c',
        options: runOptions,
      });

      expect(socket.getEmittedEvents('nospace_stderr')[0].data).toContain(
        'shutting down'
      );
    });

    it('requestId が無い・不正な run/compile は無視される', () => {
      socket.trigger('nospace_run', { code: 'c', options: runOptions });
      socket.trigger('nospace_run', {
        requestId: 123,
        code: 'c',
        options: runOptions,
      });
      socket.trigger('nospace_compile', {
        requestId: '',
        code: 'c',
        options: {},
      });

      expect(executionService.getRunCalls()).toHaveLength(0);
      expect(executionService.getCompileCalls()).toHaveLength(0);
      expect(socket.emittedEvents).toHaveLength(0);
    });

    it('payload が欠落していても例外を出さない', () => {
      expect(() => {
        socket.trigger('nospace_run', undefined);
        socket.trigger('nospace_compile', null);
        socket.trigger('nospace_kill', undefined);
      }).not.toThrow();
    });

    it('code や options が不正な場合は要求のエラーとして通知する', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-bad',
        code: 42,
        options: undefined,
      });

      expect(executionService.getRunCalls()).toHaveLength(0);
      const statuses = socket.getEmittedEvents('nospace_execution_status');
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toMatchObject({
        requestId: 'req-bad',
        status: 'error',
      });
    });

    it('BUG: 旧セッションの onExit が新セッションの登録を消さない', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-a',
        code: 'a',
        options: runOptions,
      });
      const [sessionA] = executionService.getSessionIds();
      socket.trigger('nospace_run', {
        requestId: 'req-b',
        code: 'b',
        options: runOptions,
      });
      const sessionB = executionService.getSessionIds()[0];
      expect(sessionB).not.toBe(sessionA);

      // 旧セッション A の close が後から届く
      executionService
        .getRunCalls()[0]
        .callbacks.onExit(sessionA, 'killed', null);

      // B はまだ登録されているため、切断時に kill される
      const session = executionService.getSession(
        sessionB
      ) as FakeNospaceSession;
      socket.trigger('disconnect');
      expect(session.wasKillCalled()).toBe(true);
    });

    it('run には出力の混雑状況（flowControl）が渡される', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-f',
        code: 'c',
        options: runOptions,
      });

      expect(executionService.getRunCalls()[0].flowControl).toBeDefined();
    });
  });

  describe('payload の検証', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    const validOptions = {
      language: 'standard',
      inputMode: 'interactive',
      debug: false,
    };

    /** 不正な run を送り、プロセスが起動されず requestId 付きのエラーが返ることを確認する */
    function expectRejected(options: unknown) {
      socket.trigger('nospace_run', { requestId: 'req-v', code: 'c', options });

      expect(executionService.getRunCalls()).toHaveLength(0);
      const statuses = socket.getEmittedEvents('nospace_execution_status');
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toMatchObject({
        requestId: 'req-v',
        status: 'error',
      });
      expect(socket.getEmittedEvents('nospace_stderr')[0].data).toContain(
        'Invalid run request'
      );
    }

    it('許可されない language の run は起動せず拒否する', () => {
      expectRejected({ ...validOptions, language: 'nospace20' });
    });

    it('許可されない inputMode の run は起動せず拒否する', () => {
      expectRejected({ ...validOptions, inputMode: 'remote' });
    });

    it('BUG: stdExtensions が文字列だと 1 文字ずつ --std-ext に展開されていた。リストでなければ拒否する', () => {
      expectRejected({ ...validOptions, stdExtensions: 'alloc' });
    });

    it('CLI のオプションとして解釈されうる拡張名（先頭が -）は拒否する', () => {
      expectRejected({ ...validOptions, stdExtensions: ['--debug'] });
    });

    it('許可されない compile target は起動せず拒否する', () => {
      socket.trigger('nospace_compile', {
        requestId: 'req-v',
        code: 'c',
        options: { language: 'standard', target: 'exe' },
      });

      expect(executionService.getCompileCalls()).toHaveLength(0);
      expect(
        socket.getEmittedEvents('nospace_execution_status')[0]
      ).toMatchObject({ requestId: 'req-v', status: 'error' });
    });

    it('想定外のフィールドは取り除いて渡す', () => {
      socket.trigger('nospace_run', {
        requestId: 'req-v',
        code: 'c',
        options: { ...validOptions, stdExtensions: ['alloc'], evil: 'x' },
      });

      expect(executionService.getRunCalls()[0].options).toEqual({
        ...validOptions,
        strictHeap: false,
        randomizeHeap: false,
        stdExtensions: ['alloc'],
        optPasses: [],
      });
    });
  });
});
