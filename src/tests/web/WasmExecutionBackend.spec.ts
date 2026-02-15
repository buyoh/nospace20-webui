// Unit test for WasmExecutionBackend - compile error message handling

import type { OutputEntry, CompileOptions } from '../../interfaces/NospaceTypes';

// Fake nospace20 module used by WasmExecutionBackend via dependency injection
let fakeCompileResult: any;
let fakeCompileShouldThrow: any;

jest.mock('../../web/libs/nospace20/loader', () => ({
  initNospace20Wasm: jest.fn().mockResolvedValue(undefined),
  getNospace20: () => ({
    compile: (_code: string, _target: string, _langStd: string) => {
      if (fakeCompileShouldThrow !== undefined) {
        throw fakeCompileShouldThrow;
      }
      return fakeCompileResult;
    },
    WasmWhitespaceVM: class {
      free() {}
    },
  }),
}));

// crypto.randomUUID polyfill for test
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'test-uuid' },
  });
}

import { WasmExecutionBackend } from '../../web/services/WasmExecutionBackend';

describe('WasmExecutionBackend', () => {
  let backend: WasmExecutionBackend;
  let outputEntries: OutputEntry[];

  beforeEach(async () => {
    fakeCompileResult = undefined;
    fakeCompileShouldThrow = undefined;
    outputEntries = [];

    backend = new WasmExecutionBackend();
    await backend.init();
    backend.onOutput((entry) => outputEntries.push(entry));
    backend.onStatusChange(() => {});
  });

  afterEach(() => {
    backend.dispose();
  });

  /** compile の非同期コールバックを待つ */
  const flushAsync = () => new Promise<void>((r) => setTimeout(r, 10));

  describe('compile - result handling', () => {
    const options: CompileOptions = { language: 'standard', target: 'ws' };

    it('should output successful compile result to stdout', async () => {
      fakeCompileResult = { success: true, output: 'compiled output' };
      backend.compile('code', options);
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      expect(stdoutEntry!.data).toBe('compiled output\n');
    });

    it('should output single error to stderr', async () => {
      fakeCompileResult = {
        success: false,
        errors: [{ message: 'parse error at line 1' }],
      };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toBe('parse error at line 1\n');
    });

    it('should format error with line and column info', async () => {
      fakeCompileResult = {
        success: false,
        errors: [{ message: 'syntax error', line: 5, column: 3 }],
      };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toContain('syntax error');
      expect(stderrEntry!.data).toContain(':5:3');
    });

    it('should join multiple errors with newline', async () => {
      fakeCompileResult = {
        success: false,
        errors: [
          { message: 'error one' },
          { message: 'error two', line: 10 },
        ],
      };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toContain('error one');
      expect(stderrEntry!.data).toContain('error two:10');
    });
  });

  describe('compile - exception handling', () => {
    const options: CompileOptions = { language: 'standard', target: 'ws' };

    it('should handle Error instance', async () => {
      fakeCompileShouldThrow = new Error('init failed');
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toBe('init failed\n');
    });

    it('should handle string exception', async () => {
      fakeCompileShouldThrow = 'string error';
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toBe('string error\n');
    });

    it('should stringify object exception instead of [object Object]', async () => {
      fakeCompileShouldThrow = { code: 42, detail: 'wasm panic' };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).not.toContain('[object Object]');
      expect(stderrEntry!.data).toContain('wasm panic');
    });

    it('should format ResultErr object exception', async () => {
      fakeCompileShouldThrow = {
        success: false,
        errors: [{ message: 'undefined function: sdf__puti' }],
      };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toBe('undefined function: sdf__puti\n');
    });

    it('should format ResultErr with location in exception', async () => {
      fakeCompileShouldThrow = {
        success: false,
        errors: [{ message: 'parse error', line: 3, column: 7 }],
      };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toBe('parse error:3:7\n');
    });
  });
});
