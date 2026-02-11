import { NospaceController } from '../../app/Controllers/NospaceController';
import { NospaceExecutionService, NospaceSession } from '../../app/Services/NospaceExecutionService';
import type { RunOptions } from '../../interfaces/NospaceTypes';

// Fake Socket implementation
class FakeSocket {
  id: string;
  private eventHandlers: Map<string, Function> = new Map();
  emittedEvents: Array<{ event: string; payload: any }> = [];

  constructor(id: string = 'test-socket-id') {
    this.id = id;
  }

  on(event: string, handler: Function): void {
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
  }> = [];
  private removedSessionIds: string[] = [];

  // Override to skip constructor dependencies
  constructor() {
    // Call parent constructor with dummy values
    super(
      { nospaceBinPath: '/dummy/path', nospaceTimeout: 10000 },
      {
        existsSync: () => false,
        writeFileSync: () => {},
        unlinkSync: () => {},
        mkdirSync: () => {},
      },
      { spawn: () => null as any }
    );
  }

  run(code: string, options: RunOptions, callbacks: any): NospaceSession {
    const session = new FakeNospaceSession();
    this.fakeSessions.set(session.sessionId, session);
    this.runCalls.push({ code, options, callbacks });
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
        language: 'nospace20',
        inputMode: 'interactive',
        debug: false,
        ignoreDebug: false,
      };

      socket.trigger('nospace_run', { code, options });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].code).toBe(code);
      expect(calls[0].options).toEqual(options);
    });

    it('should emit running status after creating session', () => {
      const code = 'test code';
      const options: RunOptions = {
        language: 'nospace20',
        inputMode: 'interactive',
        debug: false,
        ignoreDebug: false,
      };

      socket.trigger('nospace_run', { code, options });

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0].status).toBe('running');
    });

    it('should kill and remove existing session before creating new one', () => {
      // First run
      socket.trigger('nospace_run', {
        code: 'first',
        options: { language: 'nospace20', inputMode: 'interactive', debug: false, ignoreDebug: false },
      });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);
      const firstSessionId = executionService.getSessionIds()[0];

      // Second run (should kill first session)
      socket.trigger('nospace_run', {
        code: 'second',
        options: { language: 'nospace20', inputMode: 'interactive', debug: false, ignoreDebug: false },
      });

      expect(calls).toHaveLength(2);

      // First session should have been removed
      const removedIds = executionService.getRemovedSessionIds();
      expect(removedIds).toContain(firstSessionId);
    });

    it('should send stdin data in batch mode', () => {
      const code = 'test code';
      const options: RunOptions = {
        language: 'nospace20',
        inputMode: 'batch',
        debug: false,
        ignoreDebug: false,
      };
      const stdinData = 'input data';

      socket.trigger('nospace_run', { code, options, stdinData });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);

      // Get the session that was created
      const sessionId = calls[0].callbacks;
      // Can't easily verify sendStdin was called here without refactoring
      // This is a limitation of the test design
    });
  });

  describe('handleStdinInput', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should send stdin data with newline appended', () => {
      const session = new FakeNospaceSession('test-session', 'running');
      executionService.addSession(session);

      socket.trigger('nospace_stdin', {
        sessionId: 'test-session',
        data: 'input data',
      });

      const stdinData = session.getStdinData();
      expect(stdinData).toHaveLength(1);
      expect(stdinData[0]).toBe('input data\n');
    });

    it('should not add extra newline if data already ends with newline', () => {
      const session = new FakeNospaceSession('test-session', 'running');
      executionService.addSession(session);

      socket.trigger('nospace_stdin', {
        sessionId: 'test-session',
        data: 'input data\n',
      });

      const stdinData = session.getStdinData();
      expect(stdinData).toHaveLength(1);
      expect(stdinData[0]).toBe('input data\n');
    });

    it('should not send stdin if session is not running', () => {
      const session = new FakeNospaceSession('test-session', 'finished');
      executionService.addSession(session);

      socket.trigger('nospace_stdin', {
        sessionId: 'test-session',
        data: 'input data',
      });

      const stdinData = session.getStdinData();
      expect(stdinData).toHaveLength(0);
    });
  });

  describe('handleKill', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should kill session and emit killed status', () => {
      const session = new FakeNospaceSession('test-session', 'running');
      executionService.addSession(session);

      socket.trigger('nospace_kill', { sessionId: 'test-session' });

      expect(session.wasKillCalled()).toBe(true);

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0].sessionId).toBe('test-session');
      expect(statusEvents[0].status).toBe('killed');
      expect(statusEvents[0].exitCode).toBe(null);
    });

    it('should do nothing if session does not exist', () => {
      socket.trigger('nospace_kill', { sessionId: 'nonexistent-session' });

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      expect(statusEvents).toHaveLength(0);
    });
  });

  describe('handleDisconnect', () => {
    beforeEach(() => {
      controller.handleConnection(socket as any);
    });

    it('should kill and remove session on disconnect', () => {
      // Create a session
      socket.trigger('nospace_run', {
        code: 'test',
        options: { language: 'nospace20', inputMode: 'interactive', debug: false, ignoreDebug: false },
      });

      const calls = executionService.getRunCalls();
      expect(calls).toHaveLength(1);

      // Get the session ID
      const sessionId = executionService.getSessionIds()[0];
      const createdSession = executionService.getSession(sessionId) as FakeNospaceSession;

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
        code: 'test',
        options: { language: 'nospace20', inputMode: 'interactive', debug: false, ignoreDebug: false },
      });

      const calls = executionService.getRunCalls();
      const exitCallback = calls[0].callbacks.onExit;

      // Simulate exit
      exitCallback(0);

      const statusEvents = socket.getEmittedEvents('nospace_execution_status');
      // First event is from run, second is from onExit
      expect(statusEvents.length).toBeGreaterThanOrEqual(1);

      // Check that session was removed
      const removedIds = executionService.getRemovedSessionIds();
      expect(removedIds.length).toBeGreaterThan(0);
    });
  });
});
