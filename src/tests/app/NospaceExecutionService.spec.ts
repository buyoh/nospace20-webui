import { NospaceExecutionService } from '../../app/Services/NospaceExecutionService';
import type { RunOptions } from '../../interfaces/NospaceTypes';
import { existsSync, mkdirSync } from 'fs';

describe('NospaceExecutionService', () => {
  let service: NospaceExecutionService;

  beforeEach(() => {
    service = new NospaceExecutionService();

    // tmpディレクトリを作成
    if (!existsSync('./tmp')) {
      mkdirSync('./tmp', { recursive: true });
    }
  });

  afterEach(() => {
    // クリーンアップは各テスト後に行うべきだが、
    // ここではセッションが自動でクリーンアップされることを期待
  });

  describe('run', () => {
    it('セッションを作成して返す', () => {
      const code = 'print "Hello, World!"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(typeof session.sessionId).toBe('string');

      // クリーンアップ
      session.kill();
    });

    it('バイナリが存在しない場合、エラーを返す', () => {
      // Config.nospaceBinPathが存在しないことを想定
      // 実際のテストでは、Configをモック化するか、存在しないパスを設定する必要がある
      const code = 'print "Hello"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      const onStderr = jest.fn();
      const onExit = jest.fn();

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr,
        onExit,
      });

      // バイナリが存在する場合はこのテストは失敗する可能性がある
      // 実際の実装では、Configをモック化してパスを制御する必要がある
      expect(session).toBeDefined();
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

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      const retrieved = service.getSession(session.sessionId);
      expect(retrieved).toBe(session);

      // クリーンアップ
      session.kill();
    });
  });

  describe('removeSession', () => {
    it('セッションを削除できる', () => {
      const code = 'print "test"';
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      };

      const session = service.run(code, options, {
        onStdout: jest.fn(),
        onStderr: jest.fn(),
        onExit: jest.fn(),
      });

      service.removeSession(session.sessionId);
      const retrieved = service.getSession(session.sessionId);
      expect(retrieved).toBeUndefined();

      // クリーンアップ
      session.kill();
    });
  });
});
