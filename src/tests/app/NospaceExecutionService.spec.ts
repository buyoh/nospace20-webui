import {
  NospaceExecutionService,
  FileSystem,
  ProcessSpawner,
  ExecutionConfig,
} from '../../app/Services/NospaceExecutionService';
import type { RunOptions } from '../../interfaces/NospaceTypes';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

// Fake ChildProcess for testing
class FakeChildProcess extends EventEmitter {
  public stdin: FakeWritable;
  public stdout: EventEmitter;
  public stderr: EventEmitter;
  public killed = false;
  public exitCode: number | null = null;
  public pid: number;

  constructor(pid: number = 12345) {
    super();
    this.pid = pid;
    this.stdin = new FakeWritable();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }

  kill(signal?: NodeJS.Signals | number): boolean {
    if (!this.killed) {
      this.killed = true;
      // Simulate process termination
      setTimeout(() => {
        this.exitCode = null;
        this.emit('exit', null);
      }, 10);
    }
    return true;
  }
}

class FakeWritable extends EventEmitter {
  public destroyed = false;
  public writtenData: string[] = [];

  write(data: string): boolean {
    this.writtenData.push(data);
    return true;
  }
}

describe('NospaceExecutionService', () => {
  let service: NospaceExecutionService;
  let fakeFs: FileSystem;
  let fakeSpawner: ProcessSpawner;
  let fakeConfig: ExecutionConfig;
  let fakeProcess: FakeChildProcess;
  let files: Map<string, string>;

  beforeEach(() => {
    files = new Map();

    // Fake FileSystem
    fakeFs = {
      existsSync: (path: string) => files.has(path) || path === './tmp',
      writeFileSync: (path: string, data: string) => {
        files.set(path, data);
      },
      unlinkSync: (path: string) => {
        files.delete(path);
      },
      mkdirSync: () => {},
    };

    // Fake Process
    fakeProcess = new FakeChildProcess();

    // Fake ProcessSpawner
    fakeSpawner = {
      spawn: jest.fn(() => fakeProcess as unknown as ChildProcess),
    };

    // Fake ExecutionConfig
    fakeConfig = {
      nospaceBinPath: '/fake/path/to/wsc',
      nospaceTimeout: 5000,
    };

    service = new NospaceExecutionService(fakeConfig, fakeFs, fakeSpawner);
  });

  afterEach(() => {
    // Clean up any lingering sessions
    jest.clearAllTimers();
  });

  describe('run', () => {
    it('セッションを作成してsessionsマップに登録する', () => {
      const code = 'print "Hello, World!"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      // Binary exists
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(typeof session.sessionId).toBe('string');
      expect(session.status).toBe('running');

      // Verify session is registered
      const retrieved = service.getSession(session.sessionId);
      expect(retrieved).toBe(session);

      session.kill();
    });

    it('バイナリが存在しない場合、onStderrとonExit(1)が呼ばれ、statusが"error"になる', () => {
      const code = 'print "Hello"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      const onStderr = jest.fn();
      const onExit = jest.fn();

      // Binary does NOT exist
      files.delete(fakeConfig.nospaceBinPath);

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr,
        onExit,
      });

      expect(session).toBeDefined();
      expect(session.status).toBe('error');
      expect(session.exitCode).toBe(1);
      expect(onStderr).toHaveBeenCalledWith(
        expect.stringContaining('nospace20 binary not found')
      );
      expect(onExit).toHaveBeenCalledWith(1);
    });

    it('一時ファイルにコードが書き込まれる', () => {
      const code = 'print "test code"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      // Check that a temp file was written
      const tempFiles = Array.from(files.keys()).filter((key) =>
        key.includes('nospace-')
      );
      expect(tempFiles.length).toBe(1);
      expect(files.get(tempFiles[0])).toBe(code);

      session.kill();
    });

    it('writeFileSyncが失敗した場合、例外がthrowされonStderr/onExitが呼ばれる', () => {
      const code = 'print "test"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onStderr = jest.fn();
      const onExit = jest.fn();

      // Make writeFileSync throw
      fakeFs.writeFileSync = () => {
        throw new Error('Disk full');
      };

      expect(() => {
        service.run(code, options, {
          onStdout: jest.fn(),
          onStderr,
          onExit,
        });
      }).toThrow('Disk full');

      expect(onStderr).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write temporary file')
      );
      expect(onExit).toHaveBeenCalledWith(1);
    });

    it('コマンド引数が正しく構築される (standard, no debug)', () => {
      const code = 'code';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      expect(fakeSpawner.spawn).toHaveBeenCalledWith(
        fakeConfig.nospaceBinPath,
        expect.arrayContaining(['--std', 'standard'])
      );
    });

    it('コマンド引数が正しく構築される (with debug and ignoreDebug)', () => {
      const code = 'code';
      const options: RunOptions = {
        language: 'ws',
        debug: true,
        ignoreDebug: true,
        inputMode: 'interactive',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      expect(fakeSpawner.spawn).toHaveBeenCalledWith(
        fakeConfig.nospaceBinPath,
        expect.arrayContaining([
          '--std',
          'ws',
          '--debug',
          '--ignore-debug',
        ])
      );
    });
  });

  describe('session behavior', () => {
    it('正常終了時: statusが"finished"、exitCodeが0、一時ファイルが削除される', (done) => {
      const code = 'print "done"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onExit = jest.fn((code) => {
        expect(code).toBe(0);
        expect(session.status).toBe('finished');
        expect(session.exitCode).toBe(0);

        // Check temp file was deleted
        const tempFiles = Array.from(files.keys()).filter((key) =>
          key.includes('nospace-')
        );
        expect(tempFiles.length).toBe(0);

        done();
      });

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit,
      });

      // Simulate successful exit
      setTimeout(() => {
        fakeProcess.emit('exit', 0);
      }, 50);
    });

    it('異常終了時: statusが"error"、exitCodeが非0', (done) => {
      const code = 'bad code';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onExit = jest.fn((code) => {
        expect(code).toBe(1);
        expect(session.status).toBe('error');
        expect(session.exitCode).toBe(1);
        done();
      });

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit,
      });

      // Simulate error exit
      setTimeout(() => {
        fakeProcess.emit('exit', 1);
      }, 50);
    });

    it('kill呼び出し時: statusが"killed"、SIGTERMが送信される', (done) => {
      const code = 'infinite loop';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn((code) => {
          expect(code).toBeNull();
          expect(session.status).toBe('killed');
          done();
        }),
      });

      // Kill the session
      session.kill();
      expect(session.status).toBe('killed');
    });

    it('sendStdin: process.stdin.writeにデータが渡される', () => {
      const code = 'input test';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'interactive',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      session.sendStdin('test input\n');

      expect((fakeProcess.stdin as FakeWritable).writtenData).toContain(
        'test input\n'
      );

      session.kill();
    });

    it('タイムアウト後に自動killされる', (done) => {
      jest.useFakeTimers();

      const code = 'slow code';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onStderr = jest.fn();
      const onExit = jest.fn();

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr,
        onExit,
      });

      expect(session.status).toBe('running');

      // Fast-forward time past timeout
      jest.advanceTimersByTime(fakeConfig.nospaceTimeout + 100);

      // Check that timeout message was sent
      expect(onStderr).toHaveBeenCalledWith(
        expect.stringContaining('Process timeout')
      );

      jest.useRealTimers();
      done();
    });

    it('stdout/stderrデータがコールバックに渡される', () => {
      const code = 'output test';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onStdout = jest.fn();
      const onStderr = jest.fn();

      service.run(code, options, {
        onStdout,
        onStderr,
        onExit: jest.fn(),
      });

      // Simulate stdout
      fakeProcess.stdout.emit('data', Buffer.from('output line\n'));
      expect(onStdout).toHaveBeenCalledWith('output line\n');

      // Simulate stderr
      fakeProcess.stderr.emit('data', Buffer.from('error line\n'));
      expect(onStderr).toHaveBeenCalledWith('error line\n');
    });
  });

  describe('getSession', () => {
    it('存在しないセッションIDの場合はundefinedを返す', () => {
      const result = service.getSession('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('作成したセッションを取得できる', () => {
      const code = 'print "test"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      const retrieved = service.getSession(session.sessionId);
      expect(retrieved).toBe(session);

      session.kill();
    });
  });

  describe('removeSession', () => {
    it('セッションを削除後、getSessionでundefinedを返す', () => {
      const code = 'print "test"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      service.removeSession(session.sessionId);
      const retrieved = service.getSession(session.sessionId);
      expect(retrieved).toBeUndefined();

      session.kill();
    });
  });
});
