// WASM flavor execution backend

import { initNospace20Wasm, getNospace20 } from '../libs/nospace20/loader';
import type {
  ExecutionStatus,
  OutputEntry,
  CompileOptions,
  RunOptions,
} from '../../interfaces/NospaceTypes';
import type {
  ExecutionBackend,
  ExecutionBackendCapabilities,
} from './ExecutionBackend';
import {
  formatErrorEntries,
  isNospaceErrorResult,
} from '../libs/formatNospaceErrors';

import {
  clampMaxMemoryCells,
  clampMaxTotalSteps,
  clampStepBudget,
} from '../libs/executionLimits';
import { createDefaultRequestIdGenerator } from '../libs/requestId';

/**
 * ステップ実行ループ用 VM アダプタ。
 * WasmWhitespaceVM のメソッド名（snake_case）を、ループ側の名前に対応づける。
 */
interface VmAdapter {
  step(budget: number): { status: string; error?: string };
  flushStdout(): string;
  getTraced(): any;
  totalSteps(): number;
  free(): void;
}

/** WasmWhitespaceVM をアダプタ化する */
function adaptWhitespaceVm(vm: any): VmAdapter {
  return {
    step: (b) => vm.step(b),
    flushStdout: () => vm.flush_stdout(),
    getTraced: () => vm.get_traced(),
    totalSteps: () => vm.total_steps(),
    free: () => vm.free(),
  };
}

/**
 * WASM ローダーのインターフェース。
 * テスト時に環境に依存しないフェイク実装を注入できる。
 */
export interface Nospace20Loader {
  /** WASM モジュールを初期化する */
  initNospace20Wasm(): Promise<void>;
  /** nospace20 API（WASM モジュール）を返す */
  getNospace20(): any;
}

/** デフォルトローダー（実際のローダー模ジュールを使用） */
const defaultLoader: Nospace20Loader = {
  initNospace20Wasm,
  getNospace20,
};

/** WASM 上で nospace を実行する ExecutionBackend 実装 */
export class WasmExecutionBackend implements ExecutionBackend {
  readonly flavor = 'wasm' as const;

  private readonly loader: Nospace20Loader;
  /** 実行中の VM（dispose で解放するための参照）。ループ内では常にローカル変数の VM を使う */
  private vm: any | null = null;
  /** 解放済みの VM（二重解放の防止） */
  private freedVms = new WeakSet<object>();
  private abortController: AbortController | null = null;
  /**
   * 現在の実行の signal。中断された実行は、これと一致する（= 置き換えられていない）場合のみ
   * killed を通知する。run() で置き換えられた旧実行の killed が、新しい実行の状態を上書きしないため。
   * （外部からの kill() 直後に run() した場合も、旧実行は置き換えられた扱いになる）
   */
  private activeSignal: AbortSignal | null = null;
  private readonly generateSessionId = createDefaultRequestIdGenerator();
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback:
    | ((
        status: ExecutionStatus,
        sessionId: string,
        exitCode?: number | null
      ) => void)
    | null = null;
  private compileErrorsCallback: ((errors: any[]) => void) | null = null;
  private ready = false;

  /**
   * @param loader nospace20 WASM ローダー。省略時はデフォルトローダーを使用する。
   */
  constructor(loader: Nospace20Loader = defaultLoader) {
    this.loader = loader;
  }

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: false,
    supportsCompile: true,
    supportsLanguageSubsetForRun: false,
    requiresServer: false,
  };

  async init(): Promise<void> {
    await this.loader.initNospace20Wasm();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    // Kill any existing execution.
    this.kill();

    const sessionId = this.generateSessionId();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    // 以降、旧実行の signal は active ではなくなり、旧実行の killed は通知されない
    this.activeSignal = signal;

    const stepBudget = clampStepBudget(options.stepBudget);
    const maxTotalSteps = clampMaxTotalSteps(options.maxTotalSteps);

    // Start async execution loop
    this.runAsync(
      code,
      options,
      stdinData ?? '',
      sessionId,
      signal,
      stepBudget,
      maxTotalSteps
    );
  }

  private async runAsync(
    code: string,
    options: RunOptions,
    stdinData: string,
    sessionId: string,
    signal: AbortSignal,
    stepBudget: number,
    maxTotalSteps: number
  ): Promise<void> {
    const nospace20 = this.loader.getNospace20();
    // BUG FIX: 以前はループ終了時に `this.vm?.free()` としていたため、run() で新しい実行に
    // 置き換えられた場合、旧ループの finally が「その時点の this.vm（新しい VM）」を解放し、
    // 新ループの次の step() が解放済みの VM に触れていた。
    // 解決策として、このループが作った VM をローカル変数で保持し、finally ではそれだけを解放する。
    let vm: any = null;

    try {
      const stdExtensions = options.stdExtensions?.length
        ? (options.stdExtensions as any)
        : null;
      // 0 は無制限。未指定は WASM 側の既定値（4,194,304）になる
      const maxMemoryCells =
        options.maxMemoryCells === undefined
          ? null
          : clampMaxMemoryCells(options.maxMemoryCells);
      const strictHeap = options.strictHeap ?? null;
      const randomizeHeap = options.randomizeHeap ?? null;

      if (options.language === 'ws') {
        // Whitespace ソースを直接実行
        vm = nospace20.WasmWhitespaceVM.fromWhitespace(
          code,
          stdinData,
          stdExtensions,
          maxMemoryCells,
          strictHeap,
          randomizeHeap
        );
      } else {
        // nospace → Whitespace コンパイル → WS VM 実行
        vm = new nospace20.WasmWhitespaceVM(
          code,
          stdinData,
          null,
          stdExtensions,
          options.optPasses?.length ? (options.optPasses as any) : null,
          maxMemoryCells,
          strictHeap,
          randomizeHeap
        );
      }
      const adapter = adaptWhitespaceVm(vm);
      this.vm = vm;

      this.statusCallback?.('running', sessionId);
      this.outputCallback?.({
        type: 'system',
        data: `[WASM execution started]\n`,
        timestamp: Date.now(),
      });

      await this.runVmLoop(
        adapter,
        signal,
        stepBudget,
        maxTotalSteps,
        sessionId,
        options
      );
    } catch (e) {
      this.handleWasmError(e);
      this.statusCallback?.('error', sessionId);
    } finally {
      if (this.vm === vm) this.vm = null;
      this.releaseVm(vm);
    }
  }

  /** VM を一度だけ解放する（dispose とループ終了の両方から呼ばれても二重解放しない） */
  private releaseVm(vm: any | null): void {
    if (!vm || this.freedVms.has(vm)) return;
    this.freedVms.add(vm);
    vm.free();
  }

  /** VM アダプタを使ったステップ実行ループ */
  private async runVmLoop(
    adapter: VmAdapter,
    signal: AbortSignal,
    stepBudget: number,
    maxTotalSteps: number,
    sessionId: string,
    options: RunOptions
  ): Promise<void> {
    while (!signal.aborted) {
      const result = adapter.step(stepBudget);

      // Flush stdout
      const stdout = adapter.flushStdout();
      if (stdout.length > 0) {
        this.outputCallback?.({
          type: 'stdout',
          data: stdout,
          timestamp: Date.now(),
        });
      }

      if (result.status === 'complete') {
        // Debug info
        if (options.debug) {
          const traced = adapter.getTraced();
          if (traced && Object.keys(traced).length > 0) {
            this.outputCallback?.({
              type: 'stderr',
              data: `[Trace] ${JSON.stringify(traced)}\n`,
              timestamp: Date.now(),
            });
          }
        }

        this.statusCallback?.('finished', sessionId, 0);
        this.outputCallback?.({
          type: 'system',
          data: `\n[WASM execution completed (${adapter.totalSteps()} steps)]\n`,
          timestamp: Date.now(),
        });
        break;
      }

      if (result.status === 'error') {
        this.outputCallback?.({
          type: 'stderr',
          data: result.error ?? 'Unknown error',
          timestamp: Date.now(),
        });
        this.statusCallback?.('error', sessionId);
        this.outputCallback?.({
          type: 'system',
          data: `\n[WASM execution error]\n`,
          timestamp: Date.now(),
        });
        break;
      }

      // Check max steps
      if (adapter.totalSteps() >= maxTotalSteps) {
        this.outputCallback?.({
          type: 'stderr',
          data: `Execution limit reached (${maxTotalSteps} steps)\n`,
          timestamp: Date.now(),
        });
        this.statusCallback?.('killed', sessionId);
        break;
      }

      // Yield control to UI
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    // If aborted（新しい run() に置き換えられた場合は、新しい実行の状態を上書きしないよう通知しない）
    if (signal.aborted && this.activeSignal === signal) {
      this.statusCallback?.('killed', sessionId);
      this.outputCallback?.({
        type: 'system',
        data: `\n[WASM execution killed]\n`,
        timestamp: Date.now(),
      });
    }
  }

  compile(code: string, options: CompileOptions): void {
    const sessionId = this.generateSessionId();

    (async () => {
      const nospace20 = this.loader.getNospace20();

      try {
        this.statusCallback?.('compiling', sessionId);

        const result = nospace20.compile(
          code,
          options.target,
          options.language,
          options.stdExtensions.length > 0
            ? (options.stdExtensions as any)
            : null,
          options.optPasses?.length > 0 ? (options.optPasses as any) : null
        );

        // CompileResult は discriminated union:
        //   { success: true, output: string } | { success: false, errors: WasmError[] }
        if (result.success) {
          const outputData = result.output;
          this.outputCallback?.({
            type: 'stdout',
            data: outputData,
            timestamp: Date.now(),
          });
          this.statusCallback?.('finished', sessionId, 0);
        } else {
          const errorMessages = formatErrorEntries(result.errors);
          this.outputCallback?.({
            type: 'stderr',
            data: errorMessages + '\n',
            timestamp: Date.now(),
          });
          // 構造化エラーをコールバックに渡す
          this.compileErrorsCallback?.(result.errors);
          this.statusCallback?.('error', sessionId);
        }
      } catch (e) {
        this.handleWasmError(e);
        this.statusCallback?.('error', sessionId);
      }
    })();
  }

  /**
   * WASM が throw した例外を整形して outputCallback / compileErrorsCallback に渡す共通処理。
   * NOTE: wasm が throw する値は Error インスタンスではない場合がある。
   * ResultErr 型 ({ success: false, errors: [...] }) の場合は整形して表示する。
   * String(obj) は [object Object] になるため、それ以外は JSON.stringify で表示する。
   */
  private handleWasmError(e: unknown): void {
    if (isNospaceErrorResult(e)) {
      const message = formatErrorEntries(e.errors);
      this.outputCallback?.({
        type: 'stderr',
        data: message + '\n',
        timestamp: Date.now(),
      });
      // BUG FIX: 実行時にコンパイルエラーが発生した場合（WasmWhitespaceVM コンストラクタが
      // ResultErr をスロー）、構造化エラーをコールバックに渡してエディタのアノテーション表示
      // に反映させる。compile() メソッドと同様の処理が必要だった。
      this.compileErrorsCallback?.(e.errors);
    } else {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'string'
            ? e
            : JSON.stringify(e);
      this.outputCallback?.({
        type: 'stderr',
        data: message + '\n',
        timestamp: Date.now(),
      });
    }
  }

  sendStdin(_data: string): void {
    // WASM flavor doesn't support interactive stdin
    // no-op
  }

  kill(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  dispose(): void {
    this.kill();
    const vm = this.vm;
    this.vm = null;
    this.releaseVm(vm);
    // 中断されたループの killed 通知などが、破棄後の backend から UI へ流れ込まないようにする
    this.outputCallback = null;
    this.statusCallback = null;
    this.compileErrorsCallback = null;
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null
    ) => void
  ): void {
    this.statusCallback = callback;
  }

  onCompileErrors(callback: (errors: any[]) => void): void {
    this.compileErrorsCallback = callback;
  }
}
