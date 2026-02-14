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

    it('should output string result to stdout', async () => {
      fakeCompileResult = 'compiled output';
      backend.compile('code', options);
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      expect(stdoutEntry!.data).toBe('compiled output\n');
    });

    it('should output result.ok string to stdout', async () => {
      fakeCompileResult = { ok: 'success output' };
      backend.compile('code', options);
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      expect(stdoutEntry!.data).toBe('success output\n');
    });

    it('should output result.error string to stderr', async () => {
      fakeCompileResult = { error: 'parse error at line 1' };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toBe('parse error at line 1\n');
    });

    it('should stringify result.error object instead of [object Object]', async () => {
      fakeCompileResult = { error: { message: 'syntax error', line: 5, col: 3 } };
      backend.compile('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).not.toContain('[object Object]');
      expect(stderrEntry!.data).toContain('syntax error');
    });

    it('should stringify result.ok object instead of [object Object]', async () => {
      fakeCompileResult = { ok: { instructions: ['push 1', 'push 2'] } };
      backend.compile('code', options);
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      expect(stdoutEntry!.data).not.toContain('[object Object]');
      expect(stdoutEntry!.data).toContain('push 1');
    });

    it('should JSON.stringify unknown result shape', async () => {
      fakeCompileResult = { unknown: 'shape' };
      backend.compile('code', options);
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      expect(stdoutEntry!.data).not.toContain('[object Object]');
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
  });
});
