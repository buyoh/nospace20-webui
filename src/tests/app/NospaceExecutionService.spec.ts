import {
  NospaceExecutionService,
  FileSystem,
  ProcessSpawner,
  ExecutionConfig,
} from '../../app/Services/NospaceExecutionService';
import { ExecutionLimitError } from '../../app/Services/ExecutionSlotLimiter';
import type { OutputFlowControl } from '../../app/Services/NospaceExecutionService';
import type { RunOptions, CompileOptions } from '../../interfaces/NospaceTypes';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Fake ChildProcess for testing
class FakeChildProcess extends EventEmitter {
  public stdin: FakeWritable;
  public stdout: FakeReadable;
  public stderr: FakeReadable;
  public killed = false;
  public exitCode: number | null = null;
  public pid: number;

  constructor(pid: number = 12345) {
    super();
    this.pid = pid;
    this.stdin = new FakeWritable();
    this.stdout = new FakeReadable();
    this.stderr = new FakeReadable();
  }

  kill(_signal?: NodeJS.Signals | number): boolean {
    if (!this.killed) {
      this.killed = true;
      // Simulate process termination
      setTimeout(() => {
        this.exitCode = null;
        this.emit('close', null);
      }, 10);
    }
    return true;
  }
}

/** setEncoding / pause / resume の呼び出しを記録するフェイクの読み取りストリーム */
class FakeReadable extends EventEmitter {
  public encoding: string | null = null;
  public pauseCount = 0;
  public resumeCount = 0;

  setEncoding(encoding: string): this {
    this.encoding = encoding;
    return this;
  }

  pause(): this {
    this.pauseCount += 1;
    return this;
  }

  resume(): this {
    this.resumeCount += 1;
    return this;
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
  /** spawn() 呼び出し引数の記録: [cmd, args, options] の配列 */
  let spawnCalls: Array<[string, string[], any]>;

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

    // Fake ProcessSpawner (jest.fn() を使わないプレーン実装)
    spawnCalls = [];
    fakeSpawner = {
      spawn: (cmd: string, args: string[], options?: any) => {
        spawnCalls.push([cmd, args, options]);
        return fakeProcess as unknown as ChildProcess;
      },
    };

    // Fake ExecutionConfig
    fakeConfig = {
      nospaceBinPath: '/fake/path/to/wsc',
      nospaceTimeout: 5000,
      nospaceMaxProcesses: 5,
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
        expect.any(String),
        expect.stringContaining('nospace20 binary not found')
      );
      expect(onExit).toHaveBeenCalledWith(expect.any(String), 'error', 1);
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

    it('BUG: writeFileSyncが失敗しても例外を投げず、エラーセッションを返しonStderr/onExitが呼ばれる', () => {
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

      // socket.io のハンドラ内で例外が漏れるとサーバが停止するため、throw せずエラーセッションとして返す
      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr,
        onExit,
      });

      expect(session.status).toBe('error');
      expect(service.getSession(session.sessionId)).toBe(session);

      expect(onStderr).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Failed to write temporary file')
      );
      expect(onExit).toHaveBeenCalledWith(expect.any(String), 'error', 1);
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

      expect(spawnCalls[0][0]).toBe(fakeConfig.nospaceBinPath);
      expect(spawnCalls[0][1]).toEqual(
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

      expect(spawnCalls[0][0]).toBe(fakeConfig.nospaceBinPath);
      expect(spawnCalls[0][1]).toEqual(
        expect.arrayContaining(['--std', 'ws', '--debug', '--ignore-debug'])
      );
    });

    it('コマンド引数が正しく構築される (with stdExtensions)', () => {
      const code = 'code';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        stdExtensions: ['alloc'],
      };

      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      expect(spawnCalls[0][1]).toEqual(
        expect.arrayContaining(['--std', 'standard', '--std-ext', 'alloc'])
      );
    });

    it('コマンド引数が正しく構築される (stdExtensions 未指定)', () => {
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

      expect(spawnCalls[0][1]).not.toContain('--std-ext');
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

      const onExit = jest.fn((_sessionId, _status, code) => {
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
        fakeProcess.emit('close', 0);
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

      const onExit = jest.fn((_sessionId, _status, code) => {
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
        fakeProcess.emit('close', 1);
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
        onExit: jest.fn((_sessionId, _status, code) => {
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
        expect.any(String),
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
      expect(onStdout).toHaveBeenCalledWith(
        expect.any(String),
        'output line\n'
      );

      // Simulate stderr
      fakeProcess.stderr.emit('data', Buffer.from('error line\n'));
      expect(onStderr).toHaveBeenCalledWith(expect.any(String), 'error line\n');
    });
  });

  describe('compile', () => {
    const compileOptions: CompileOptions = {
      language: 'standard',
      target: 'ws',
    };

    it('compile で正しいコマンドライン引数を構築する', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.compile('code', compileOptions, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      expect(spawnCalls).toHaveLength(1);
      expect(spawnCalls[0][0]).toBe(fakeConfig.nospaceBinPath);
      expect(spawnCalls[0][1]).toEqual(
        expect.arrayContaining([
          '--mode',
          'compile',
          '--std',
          'standard',
          '--target',
          'ws',
        ])
      );
    });

    it('compile で --mode compile が含まれる', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.compile(
        'code',
        { language: 'min', target: 'mnemonic' },
        {
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onExit: jest.fn(),
        }
      );

      const spawnArgs = spawnCalls[0][1];
      expect(spawnArgs).toContain('--mode');
      expect(spawnArgs).toContain('compile');
      expect(spawnArgs).toContain('--std');
      expect(spawnArgs).toContain('min');
      expect(spawnArgs).toContain('--target');
      expect(spawnArgs).toContain('mnemonic');
    });

    it('compile で一時ファイルを作成する', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.compile('source-code', compileOptions, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      // 一时ファイルが作成されたか確認
      const createdFiles = Array.from(files.keys()).filter(
        (k) => k.includes('nospace-') && k.endsWith('.ns')
      );
      expect(createdFiles).toHaveLength(1);
      expect(files.get(createdFiles[0])).toBe('source-code');
    });

    it('compile でコンパイル成功時に stdout を通知する', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onStdout = jest.fn();

      service.compile('code', compileOptions, {
        onStdout,
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      fakeProcess.stdout.emit('data', Buffer.from('compiled output\n'));
      expect(onStdout).toHaveBeenCalledWith(
        expect.any(String),
        'compiled output\n'
      );
    });

    it('compile でコンパイルエラー時に stderr を通知する', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onStderr = jest.fn();

      service.compile('code', compileOptions, {
        onStdout: jest.fn(),
        onStderr,
        onExit: jest.fn(),
      });

      fakeProcess.stderr.emit('data', Buffer.from('error: undefined\n'));
      expect(onStderr).toHaveBeenCalledWith(
        expect.any(String),
        'error: undefined\n'
      );
    });

    it('compile でプロセス終了時にコールバックを呼び出す', (done) => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      const onExit = jest.fn((_sessionId, _status, code) => {
        expect(code).toBe(0);
        done();
      });

      service.compile('code', compileOptions, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit,
      });

      fakeProcess.emit('close', 0);
    });

    it('compile でサポート外ターゲットをエラーにする', () => {
      const onStderr = jest.fn();
      const onExit = jest.fn();

      const session = service.compile(
        'code',
        { language: 'standard', target: 'ex-ws' },
        {
          onStdout: jest.fn(),
          onStderr,
          onExit,
        }
      );

      expect(session.status).toBe('error');
      expect(onStderr).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Unsupported compile target')
      );
      expect(onExit).toHaveBeenCalledWith(expect.any(String), 'error', 1);
      // spawn は呼ばれない
      expect(spawnCalls).toHaveLength(0);
    });

    it('compile でバイナリ未存在時にエラーを返す', () => {
      const onStderr = jest.fn();
      const onExit = jest.fn();

      // Binary does NOT exist
      files.delete(fakeConfig.nospaceBinPath);

      const session = service.compile('code', compileOptions, {
        onStdout: jest.fn(),
        onStderr,
        onExit,
      });

      expect(session.status).toBe('error');
      expect(onStderr).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('nospace20 binary not found')
      );
      expect(onExit).toHaveBeenCalledWith(expect.any(String), 'error', 1);
    });

    it('compile で stdExtensions が --std-ext フラグとして渡される', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.compile(
        'code',
        {
          language: 'standard',
          target: 'ws',
          stdExtensions: ['alloc', 'debug'],
          optPasses: [],
        },
        {
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onExit: jest.fn(),
        }
      );

      const spawnArgs = spawnCalls[0][1];
      expect(spawnArgs).toContain('--std-ext');
      // --std-ext alloc と --std-ext debug が両方含まれる
      const stdExtIndices = spawnArgs.reduce(
        (acc: number[], arg: string, i: number) => {
          if (arg === '--std-ext') acc.push(i);
          return acc;
        },
        []
      );
      expect(stdExtIndices).toHaveLength(2);
      expect(spawnArgs[stdExtIndices[0] + 1]).toBe('alloc');
      expect(spawnArgs[stdExtIndices[1] + 1]).toBe('debug');
    });

    it('compile で stdExtensions が空の場合 --std-ext は含まれない', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      service.compile(
        'code',
        {
          language: 'standard',
          target: 'ws',
          stdExtensions: [],
          optPasses: [],
        },
        {
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onExit: jest.fn(),
        }
      );

      const spawnArgs = spawnCalls[0][1];
      expect(spawnArgs).not.toContain('--std-ext');
    });

    it('compile で stdExtensions が未定義の場合 --std-ext は含まれない', () => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');

      // CompileOptions の stdExtensions が undefined（旧クライアントからのリクエスト想定）
      service.compile(
        'code',
        { language: 'standard', target: 'ws' } as CompileOptions,
        {
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onExit: jest.fn(),
        }
      );

      const spawnArgs = spawnCalls[0][1];
      expect(spawnArgs).not.toContain('--std-ext');
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

  describe('実行枠・終了処理・背圧', () => {
    const runOptions: RunOptions = {
      language: 'standard',
      debug: false,
      ignoreDebug: false,
      inputMode: 'batch',
    };

    /** コールバックの呼び出しを記録する */
    function recorder() {
      const calls: string[] = [];
      return {
        calls,
        callbacks: {
          onStdout: (_id: string, data: string) => calls.push(`out:${data}`),
          onStderr: (_id: string, data: string) => calls.push(`err:${data}`),
          onExit: (_id: string, status: string, code: number | null) =>
            calls.push(`exit:${status}:${code}`),
        },
      };
    }

    beforeEach(() => {
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');
    });

    it('同時実行数の上限に達すると ExecutionLimitError を投げ、一時ファイルを作らない', () => {
      fakeConfig.nospaceMaxProcesses = 1;
      service = new NospaceExecutionService(fakeConfig, fakeFs, fakeSpawner);
      const first = service.run('a', runOptions, recorder().callbacks);
      const tempFilesBefore = Array.from(files.keys()).filter((k) =>
        k.includes('nospace-')
      ).length;

      const second = recorder();
      expect(() => service.run('b', runOptions, second.callbacks)).toThrow(
        ExecutionLimitError
      );
      expect(second.calls).toEqual([]);
      expect(
        Array.from(files.keys()).filter((k) => k.includes('nospace-')).length
      ).toBe(tempFilesBefore);

      first.kill();
    });

    it('プロセスが close すると実行枠が解放され、次の実行ができる', () => {
      fakeConfig.nospaceMaxProcesses = 1;
      service = new NospaceExecutionService(fakeConfig, fakeFs, fakeSpawner);
      service.run('a', runOptions, recorder().callbacks);

      fakeProcess.emit('close', 0);

      fakeProcess = new FakeChildProcess(2);
      expect(() =>
        service.run('b', runOptions, recorder().callbacks)
      ).not.toThrow();
    });

    it('BUG: error イベントのみ発火しても未処理例外にならず、実行枠・一時ファイルが解放され onExit は 1 回だけ呼ばれる', () => {
      fakeConfig.nospaceMaxProcesses = 1;
      service = new NospaceExecutionService(fakeConfig, fakeFs, fakeSpawner);
      const rec = recorder();
      const session = service.run('a', runOptions, rec.callbacks);

      // リスナーが無いと EventEmitter は例外を投げる（実環境ではプロセス停止）
      expect(() =>
        fakeProcess.emit('error', new Error('spawn EACCES'))
      ).not.toThrow();
      // 続けて close が来ても二重通知しない
      fakeProcess.emit('close', null);

      expect(session.status).toBe('error');
      expect(rec.calls.filter((c) => c.startsWith('exit:'))).toEqual([
        'exit:error:null',
      ]);
      expect(rec.calls).toContain('err:spawn EACCES\n');
      expect(
        Array.from(files.keys()).filter((k) => k.includes('nospace-'))
      ).toHaveLength(0);

      fakeProcess = new FakeChildProcess(3);
      expect(() =>
        service.run('b', runOptions, recorder().callbacks)
      ).not.toThrow();
    });

    it('BUG: エラー時の onExit 通知時点で、セッションが既に登録されている', () => {
      files.delete(fakeConfig.nospaceBinPath);
      let registeredAtExit: unknown = 'unset';
      const session = service.run('a', runOptions, {
        onStdout: () => {},
        onStderr: () => {},
        onExit: (id) => {
          registeredAtExit = service.getSession(id);
          service.removeSession(id);
        },
      });

      expect(registeredAtExit).toBe(session);
      // onExit 内の removeSession が効き、Map に残り続けない
      expect(service.getSession(session.sessionId)).toBeUndefined();
    });

    it('バイナリ未検出・書き込み失敗でも実行枠がリークしない', () => {
      fakeConfig.nospaceMaxProcesses = 1;
      service = new NospaceExecutionService(fakeConfig, fakeFs, fakeSpawner);
      files.delete(fakeConfig.nospaceBinPath);
      service.run('a', runOptions, recorder().callbacks);
      files.set(fakeConfig.nospaceBinPath, 'fake-binary');
      const originalWrite = fakeFs.writeFileSync;
      fakeFs.writeFileSync = () => {
        throw new Error('Disk full');
      };
      service.run('b', runOptions, recorder().callbacks);
      fakeFs.writeFileSync = originalWrite;

      expect(() =>
        service.run('c', runOptions, recorder().callbacks)
      ).not.toThrow();
    });

    it('stdout/stderr は utf8 でデコードされる設定になる', () => {
      service.run('a', runOptions, recorder().callbacks);

      expect(fakeProcess.stdout.encoding).toBe('utf8');
      expect(fakeProcess.stderr.encoding).toBe('utf8');
    });

    /** 混雑状態を外から操作できる OutputFlowControl */
    function fakeFlow() {
      let congested = false;
      let listener: (() => void) | null = null;
      let unsubscribed = false;
      const flow: OutputFlowControl = {
        isCongested: () => congested,
        onDrain: (l) => {
          listener = l;
          return () => {
            unsubscribed = true;
            listener = null;
          };
        },
      };
      return {
        flow,
        setCongested: (v: boolean) => (congested = v),
        drain: () => listener?.(),
        wasUnsubscribed: () => unsubscribed,
      };
    }

    it('送信待ちが混雑すると出力の読み取りを止め、drain で再開する', () => {
      const f = fakeFlow();
      service.run('a', runOptions, recorder().callbacks, f.flow);

      f.setCongested(true);
      fakeProcess.stdout.emit('data', 'chunk');
      expect(fakeProcess.stdout.pauseCount).toBe(1);
      expect(fakeProcess.stderr.pauseCount).toBe(1);

      // まだ混雑中の drain では再開しない
      f.drain();
      expect(fakeProcess.stdout.resumeCount).toBe(0);

      f.setCongested(false);
      f.drain();
      expect(fakeProcess.stdout.resumeCount).toBe(1);
      expect(fakeProcess.stderr.resumeCount).toBe(1);
    });

    it('終了後は drain の購読が解除される', () => {
      const f = fakeFlow();
      service.run('a', runOptions, recorder().callbacks, f.flow);

      fakeProcess.emit('close', 0);

      expect(f.wasUnsubscribed()).toBe(true);
    });

    it('一時停止中に kill すると読み取りを再開して close を待てる', () => {
      const f = fakeFlow();
      const session = service.run(
        'a',
        runOptions,
        recorder().callbacks,
        f.flow
      );
      f.setCongested(true);
      fakeProcess.stdout.emit('data', 'chunk');

      session.kill();

      expect(fakeProcess.stdout.resumeCount).toBe(1);
    });
  });
});
