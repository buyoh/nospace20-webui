// Unit test for WasmExecutionBackend - compile error message handling

import type { OutputEntry, CompileOptions, RunOptions } from '../../interfaces/NospaceTypes';

// Fake nospace20 module used by WasmExecutionBackend via dependency injection
let fakeCompileResult: any;
let fakeCompileShouldThrow: any;
let fakeVMConstructorShouldThrow: any;
let fakeVMStepResult: any;          // step() の返り値
let fakeVMTotalSteps = 0;           // total_steps() の返り値
let lastVMStepArg: number | undefined; // step() に渡された引数

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
      constructor() {
        if (fakeVMConstructorShouldThrow !== undefined) {
          throw fakeVMConstructorShouldThrow;
        }
      }
      step(budget: number) {
        lastVMStepArg = budget;
        return fakeVMStepResult ?? { status: 'complete' };
      }
      total_steps() { return fakeVMTotalSteps; }
      flush_stdout() { return ''; }
      get_traced() { return {}; }
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
    fakeVMConstructorShouldThrow = undefined;
    fakeVMStepResult = undefined;
    fakeVMTotalSteps = 0;
    lastVMStepArg = undefined;
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
      // ws ターゲットは Whitespace 命令文字として '\n' を含むため、末尾改行を付加しない
      expect(stdoutEntry!.data).toBe('compiled output');
    });

    it('should NOT append trailing newline for ws target', async () => {
      fakeCompileResult = { success: true, output: '  \t\n' };
      backend.compile('code', { language: 'standard', target: 'ws' });
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      // ws ターゲット: 余分な '\n' を付加しない（Whitespace の命令バイナリを破壊しないため）
      expect(stdoutEntry!.data).toBe('  \t\n');
    });

    it('should NOT append trailing newline for ex-ws target', async () => {
      fakeCompileResult = { success: true, output: '  \t\n' };
      backend.compile('code', { language: 'standard', target: 'ex-ws' });
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      // ex-ws ターゲット: Whitespace と同様に空白文字が命令のため末尾改行を付加しない
      expect(stdoutEntry!.data).toBe('  \t\n');
    });

    it('should NOT append trailing newline for mnemonic target', async () => {
      fakeCompileResult = { success: true, output: 'push 1\nend' };
      backend.compile('code', { language: 'standard', target: 'mnemonic' });
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      // mnemonic: コンパイル出力をそのまま返す（末尾改行を付加しない）
      expect(stdoutEntry!.data).toBe('push 1\nend');
    });

    it('should NOT append trailing newline for json target', async () => {
      fakeCompileResult = { success: true, output: '{"ops":[]}' };
      backend.compile('code', { language: 'standard', target: 'json' });
      await flushAsync();

      const stdoutEntry = outputEntries.find((e) => e.type === 'stdout');
      expect(stdoutEntry).toBeDefined();
      // json: コンパイル出力をそのまま返す（末尾改行を付加しない）
      expect(stdoutEntry!.data).toBe('{"ops":[]}');
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

  describe('compile - onCompileErrors callback', () => {
    const options: CompileOptions = { language: 'standard', target: 'ws' };
    let compileErrors: any[];

    beforeEach(() => {
      compileErrors = [];
      backend.onCompileErrors((errors) => {
        compileErrors = errors;
      });
    });

    it('コンパイル成功時は onCompileErrors コールバックが呼ばれない', async () => {
      fakeCompileResult = { success: true, output: 'ok' };
      backend.compile('code', options);
      await flushAsync();

      expect(compileErrors).toEqual([]);
    });

    it('コンパイルエラー時に onCompileErrors コールバックにエラー配列が渡される', async () => {
      fakeCompileResult = {
        success: false,
        errors: [{ message: 'syntax error', line: 5, column: 3 }],
      };
      backend.compile('code', options);
      await flushAsync();

      expect(compileErrors).toEqual([{ message: 'syntax error', line: 5, column: 3 }]);
    });

    it('ResultErr 例外スロー時に onCompileErrors コールバックが呼ばれる', async () => {
      fakeCompileShouldThrow = {
        success: false,
        errors: [{ message: 'undefined function: foo', line: 2 }],
      };
      backend.compile('code', options);
      await flushAsync();

      expect(compileErrors).toEqual([{ message: 'undefined function: foo', line: 2 }]);
    });

    it('ResultErr 以外の例外スロー時は onCompileErrors コールバックが呼ばれない', async () => {
      fakeCompileShouldThrow = new Error('wasm crash');
      backend.compile('code', options);
      await flushAsync();

      expect(compileErrors).toEqual([]);
    });
  });

  describe('run - compile error handling', () => {
    const options: RunOptions = { language: 'standard', debug: false, ignoreDebug: false, inputMode: 'batch' };
    let compileErrors: any[];

    beforeEach(() => {
      compileErrors = [];
      backend.onCompileErrors((errors) => {
        compileErrors = errors;
      });
    });

    it('VM コンストラクタが ResultErr をスローした場合、onCompileErrors コールバックにエラー配列が渡される', async () => {
      fakeVMConstructorShouldThrow = {
        success: false,
        errors: [{ message: 'compile error during execution', line: 3, column: 1 }],
      };
      backend.run('code', options);
      await flushAsync();

      expect(compileErrors).toEqual([{ message: 'compile error during execution', line: 3, column: 1 }]);
    });

    it('VM コンストラクタが ResultErr をスローした場合、エラーメッセージが stderr に出力される', async () => {
      fakeVMConstructorShouldThrow = {
        success: false,
        errors: [{ message: 'syntax error in run', line: 5 }],
      };
      backend.run('code', options);
      await flushAsync();

      const stderrEntry = outputEntries.find((e) => e.type === 'stderr');
      expect(stderrEntry).toBeDefined();
      expect(stderrEntry!.data).toContain('syntax error in run');
    });

    it('VM コンストラクタが ResultErr 以外の例外をスローした場合、onCompileErrors コールバックが呼ばれない', async () => {
      fakeVMConstructorShouldThrow = new Error('vm init failed');
      backend.run('code', options);
      await flushAsync();

      expect(compileErrors).toEqual([]);
    });
  });

  describe('run - stepBudget / maxTotalSteps', () => {
    it('RunOptions の stepBudget が vm.step() に渡される', async () => {
      // step が即 complete を返すよう設定済み (fakeVMStepResult = undefined → complete)
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        stepBudget: 500,
      };
      backend.run('code', options);
      await flushAsync();

      expect(lastVMStepArg).toBe(500);
    });

    it('stepBudget を省略するとデフォルト値 10000 が使われる', async () => {
      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        // stepBudget を省略
      };
      backend.run('code', options);
      await flushAsync();

      expect(lastVMStepArg).toBe(10000);
    });

    it('total_steps が maxTotalSteps に到達した場合に killed ステータスで停止する', async () => {
      // step は pending を返し続け、total_steps が maxTotalSteps を超えるよう設定
      fakeVMStepResult = { status: 'pending' };
      fakeVMTotalSteps = 2000;  // maxTotalSteps (1000) を超えている

      const statuses: string[] = [];
      backend.onStatusChange((status) => statuses.push(status));

      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        maxTotalSteps: 1000,
      };
      backend.run('code', options);
      await flushAsync();

      expect(statuses).toContain('killed');
    });

    it('maxTotalSteps を省略するとデフォルト値 100_000_000 が上限として使われる', async () => {
      // total_steps が 99_999_999 < 100_000_000 の場合は killed しない
      fakeVMStepResult = { status: 'complete' };
      fakeVMTotalSteps = 99_999_999;

      const statuses: string[] = [];
      backend.onStatusChange((status) => statuses.push(status));

      const options: RunOptions = {
        language: 'standard',
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        // maxTotalSteps を省略
      };
      backend.run('code', options);
      await flushAsync();

      // step が complete を返すので finished になる（killed にはならない）
      expect(statuses).toContain('finished');
      expect(statuses).not.toContain('killed');
    });
  });
});
