/**
 * @jest-environment node
 */
/**
 * nospace20 WASM ライブラリの統合テスト
 *
 * 実際の WASM バイナリを使用して, コンパイラ・インタプリタと
 * 周辺ライブラリ（formatNospaceErrors など）との統合動作を検証する。
 *
 * NOTE: このテストのみ nospace20NodeLoader 経由で本物の WASM に依存することが許可されている。
 * NOTE: @jest-environment node を指定（TextDecoder 等のグローバルが Node.js ネイティブで利用可能）
 */

import {
  WasmNospaceVM,
  WasmWhitespaceVM,
  compile,
  getOptions,
  parse,
} from './nospace20NodeLoader';
import {
  formatErrorEntries,
  tryFormatNospaceErrorJson,
} from '../../../web/libs/formatNospaceErrors';

// テスト用 nospace ソースコード
const HELLO_WORLD_SRC = `func: __main() {
  __putc('H');
  __putc('i');
  __putc('\\n');
  return: 0;
}`;

const PUTS_HELLO_WORLD_SRC = `func: puts(str) {
  while: *str != 0 {
    __putc(*str);
    str += 1;
  };
  __putc('\\n');
}

func: __main() {
  let: g[12]("hello\\sworld");
  puts(&g);
  return: 0;
}`;

const INVALID_SYNTAX_SRC = `@invalid_syntax`;

const STDIN_ECHO_SRC = `func: __main() {
  let: c(__getc());
  __putc(c);
  return: 0;
}`;

/** VM をステップ実行して完了まで待つ */
function runUntilComplete(vm: InstanceType<typeof WasmNospaceVM> | InstanceType<typeof WasmWhitespaceVM>) {
  const MAX_STEPS = 1_000_000;
  let totalSteps = 0;
  for (;;) {
    const result = vm.step(10000);
    totalSteps += 10000;
    if (result.status !== 'suspended') {
      return result;
    }
    if (totalSteps >= MAX_STEPS) {
      throw new Error('VM exceeded max steps');
    }
  }
}

// ----------------------------------------------------------------------------
// getOptions
// ----------------------------------------------------------------------------

describe('getOptions', () => {
  it('コンパイルターゲット一覧を返す', () => {
    const opts = getOptions();
    expect(opts.compileTargets).toContain('ws');
    expect(opts.compileTargets).toContain('mnemonic');
  });

  it('最適化パス一覧を返す', () => {
    const opts = getOptions();
    expect(opts.optPasses).toContain('all');
  });
});

// ----------------------------------------------------------------------------
// parse
// ----------------------------------------------------------------------------

describe('parse', () => {
  it('有効な nospace コードのパースが成功する', () => {
    const result = parse(HELLO_WORLD_SRC);
    expect(result.success).toBe(true);
  });

  it('構文エラーのある nospace コードのパースが失敗する', () => {
    const result = parse(INVALID_SYNTAX_SRC);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0].message).toBe('string');
    }
  });

  it('複数行コードのパースが成功する', () => {
    const result = parse(PUTS_HELLO_WORLD_SRC);
    expect(result.success).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// compile
// ----------------------------------------------------------------------------

describe('compile', () => {
  it('ws ターゲットでコンパイルが成功し whitespace コードを返す', () => {
    const result = compile(HELLO_WORLD_SRC, 'ws', 'standard');
    expect(result.success).toBe(true);
    if (result.success) {
      // whitespace コードはスペース・タブ・改行のみで構成される
      expect(result.output.length).toBeGreaterThan(0);
      expect(/^[\s]+$/.test(result.output)).toBe(true);
    }
  });

  it('mnemonic ターゲットでコンパイルが成功する', () => {
    const result = compile(HELLO_WORLD_SRC, 'mnemonic', 'standard');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.length).toBeGreaterThan(0);
    }
  });

  it('構文エラーのあるコードのコンパイルが失敗する', () => {
    const result = compile(INVALID_SYNTAX_SRC, 'ws', 'standard');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0].message).toBe('string');
    }
  });

  it('opt_passes=["all"] を指定してコンパイルが成功する', () => {
    const result = compile(HELLO_WORLD_SRC, 'ws', 'standard', null, ['all']);
    expect(result.success).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// compile と formatNospaceErrors の統合テスト
// ----------------------------------------------------------------------------

describe('compile + formatNospaceErrors 統合', () => {
  it('コンパイルエラーを formatErrorEntries で整形できる', () => {
    const result = compile(INVALID_SYNTAX_SRC, 'ws', 'standard');
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatErrorEntries(result.errors);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('エラーに行番号が含まれる場合 formatErrorEntries に行番号が出力される', () => {
    // 行番号が付加されるエラーを含むコードを使用
    const result = compile(INVALID_SYNTAX_SRC, 'ws', 'standard');
    if (!result.success && result.errors.some((e) => e.line != null)) {
      const formatted = formatErrorEntries(result.errors);
      // 行番号付きエラーは ":N" の形式が含まれる
      expect(formatted).toMatch(/:\d+/);
    }
    // line が undefined の場合も正常に動作する
    if (!result.success) {
      expect(() => formatErrorEntries(result.errors)).not.toThrow();
    }
  });

  it('tryFormatNospaceErrorJson はコンパイルエラー JSON を整形できる', () => {
    const result = compile(INVALID_SYNTAX_SRC, 'ws', 'standard');
    expect(result.success).toBe(false);
    if (!result.success) {
      // compile() の戻り値を JSON 化して tryFormatNospaceErrorJson に渡す
      const json = JSON.stringify(result);
      const formatted = tryFormatNospaceErrorJson(json);
      expect(formatted).not.toBeNull();
      expect(typeof formatted).toBe('string');
    }
  });
});

// ----------------------------------------------------------------------------
// WasmNospaceVM (直接インタプリタ実行)
// ----------------------------------------------------------------------------

describe('WasmNospaceVM', () => {
  it('Hello World コードを実行して stdout に出力される', () => {
    const vm = new WasmNospaceVM(HELLO_WORLD_SRC, '');
    const result = runUntilComplete(vm);
    const stdout = vm.flushStdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('Hi\n');
  });

  it('puts を使った Hello World コードを実行できる', () => {
    const vm = new WasmNospaceVM(PUTS_HELLO_WORLD_SRC, '');
    const result = runUntilComplete(vm);
    const stdout = vm.flushStdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('hello world\n');
  });

  it('stdin から文字を読み込んで出力できる', () => {
    const vm = new WasmNospaceVM(STDIN_ECHO_SRC, 'A');
    const result = runUntilComplete(vm);
    const stdout = vm.flushStdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('A');
  });

  it('構文エラーのあるコードでコンストラクタが例外をスローする', () => {
    expect(() => new WasmNospaceVM(INVALID_SYNTAX_SRC, '')).toThrow();
  });

  it('total_steps が実行後に 0 より大きい値を返す', () => {
    const vm = new WasmNospaceVM(HELLO_WORLD_SRC, '');
    runUntilComplete(vm);
    const steps = vm.total_steps();
    vm.free();

    expect(steps).toBeGreaterThan(0);
  });

  it('is_complete が実行完了後に true を返す', () => {
    const vm = new WasmNospaceVM(HELLO_WORLD_SRC, '');
    runUntilComplete(vm);
    const complete = vm.is_complete();
    vm.free();

    expect(complete).toBe(true);
  });

  it('opt_passes を指定した VM が正常に実行できる', () => {
    const vm = new WasmNospaceVM(HELLO_WORLD_SRC, '', ['all']);
    const result = runUntilComplete(vm);
    const stdout = vm.flushStdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('Hi\n');
  });

  it('ignore_debug=true を指定した VM が正常に実行できる', () => {
    const vm = new WasmNospaceVM(HELLO_WORLD_SRC, '', null, true);
    const result = runUntilComplete(vm);
    const stdout = vm.flushStdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('Hi\n');
  });
});

// ----------------------------------------------------------------------------
// compile + WasmWhitespaceVM 統合テスト
// ----------------------------------------------------------------------------

describe('compile + WasmWhitespaceVM 統合', () => {
  it('nospace コードをコンパイルして WasmWhitespaceVM で実行できる', () => {
    const compileResult = compile(HELLO_WORLD_SRC, 'ws', 'standard');
    expect(compileResult.success).toBe(true);
    if (!compileResult.success) return;

    const vm = WasmWhitespaceVM.fromWhitespace(compileResult.output, '');
    const result = runUntilComplete(vm);
    const stdout = vm.flush_stdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('Hi\n');
  });

  it('puts を使った nospace コードをコンパイルして WasmWhitespaceVM で実行できる', () => {
    const compileResult = compile(PUTS_HELLO_WORLD_SRC, 'ws', 'standard');
    expect(compileResult.success).toBe(true);
    if (!compileResult.success) return;

    const vm = WasmWhitespaceVM.fromWhitespace(compileResult.output, '');
    const result = runUntilComplete(vm);
    const stdout = vm.flush_stdout();
    vm.free();

    expect(result.status).toBe('complete');
    expect(stdout).toBe('hello world\n');
  });

  it('WasmNospaceVM と WasmWhitespaceVM の実行結果が一致する', () => {
    // compile → WasmWhitespaceVM
    const compileResult = compile(PUTS_HELLO_WORLD_SRC, 'ws', 'standard');
    expect(compileResult.success).toBe(true);
    if (!compileResult.success) return;
    const wsVm = WasmWhitespaceVM.fromWhitespace(compileResult.output, '');
    runUntilComplete(wsVm);
    const wsStdout = wsVm.flush_stdout();
    wsVm.free();

    // WasmNospaceVM (直接インタプリタ)
    const nsVm = new WasmNospaceVM(PUTS_HELLO_WORLD_SRC, '');
    runUntilComplete(nsVm);
    const nsStdout = nsVm.flushStdout();
    nsVm.free();

    expect(wsStdout).toBe(nsStdout);
  });
});
