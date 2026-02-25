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
import { formatErrorEntries, isNospaceErrorResult } from '../libs/formatNospaceErrors';

const DEFAULT_STEP_BUDGET = 10000;
const DEFAULT_MAX_TOTAL_STEPS = 100_000_000;

export class WasmExecutionBackend implements ExecutionBackend {
  readonly flavor = 'wasm' as const;

  private vm: any | null = null;
  private abortController: AbortController | null = null;
  private outputCallback: ((entry: OutputEntry) => void) | null = null;
  private statusCallback:
    | ((
        status: ExecutionStatus,
        sessionId: string,
        exitCode?: number | null,
      ) => void)
    | null = null;
  private compileErrorsCallback: ((errors: any[]) => void) | null = null;
  private ready = false;

  static capabilities: ExecutionBackendCapabilities = {
    supportsInteractiveStdin: false,
    supportsCompile: true,
    supportsIgnoreDebug: false,
    supportsLanguageSubsetForRun: false,
    requiresServer: false,
  };

  async init(): Promise<void> {
    await initNospace20Wasm();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  run(code: string, options: RunOptions, stdinData?: string): void {
    // Kill any existing execution
    this.kill();

    const sessionId = crypto.randomUUID();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const stepBudget = options.stepBudget ?? DEFAULT_STEP_BUDGET;
    const maxTotalSteps = options.maxTotalSteps ?? DEFAULT_MAX_TOTAL_STEPS;

    // Start async execution loop
    this.runAsync(code, options, stdinData ?? '', sessionId, signal, stepBudget, maxTotalSteps);
  }

  private async runAsync(
    code: string,
    options: RunOptions,
    stdinData: string,
    sessionId: string,
    signal: AbortSignal,
    stepBudget: number,
    maxTotalSteps: number,
  ): Promise<void> {
    const nospace20 = getNospace20();

    try {
      // Build VM
      // If options.language is 'ws', use fromWhitespace
      if (options.language === 'ws') {
        this.vm = nospace20.WasmWhitespaceVM.fromWhitespace(code, stdinData);
      } else {
        this.vm = new nospace20.WasmWhitespaceVM(code, stdinData);
      }

      this.statusCallback?.('running', sessionId);
      this.outputCallback?.({
        type: 'system',
        data: `[WASM execution started]\n`,
        timestamp: Date.now(),
      });

      // Step execution loop
      while (!signal.aborted) {
        const result = this.vm.step(stepBudget);

        // Flush stdout
        const stdout = this.vm.flush_stdout();
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
            const traced = this.vm.get_traced();
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
            data: `\n[WASM execution completed (${this.vm.total_steps()} steps)]\n`,
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
        if (this.vm.total_steps() >= maxTotalSteps) {
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

      // If aborted
      if (signal.aborted) {
        this.statusCallback?.('killed', sessionId);
        this.outputCallback?.({
          type: 'system',
          data: `\n[WASM execution killed]\n`,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      // NOTE: wasm が throw する値は Error インスタンスではない場合がある。
      // ResultErr 型 ({ success: false, errors: [...] }) の場合は整形して表示する。
      // String(obj) は [object Object] になるため、それ以外は JSON.stringify で表示する。
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
      this.statusCallback?.('error', sessionId);
    } finally {
      this.vm?.free();
      this.vm = null;
    }
  }

  compile(code: string, options: CompileOptions): void {
    const sessionId = crypto.randomUUID();

    (async () => {
      const nospace20 = getNospace20();

      try {
        this.statusCallback?.('compiling', sessionId);

        const result = nospace20.compile(code, options.target, options.language);

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
        // NOTE: wasm が throw する値は Error インスタンスではない場合がある。
        // ResultErr 型 ({ success: false, errors: [...] }) の場合は整形して表示する。
        // String(obj) は [object Object] になるため、それ以外は JSON.stringify で表示する。
        if (isNospaceErrorResult(e)) {
          const message = formatErrorEntries(e.errors);
          this.outputCallback?.({
            type: 'stderr',
            data: message + '\n',
            timestamp: Date.now(),
          });
          // 構造化エラーをコールバックに渡す
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
        this.statusCallback?.('error', sessionId);
      }
    })();
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
    this.vm?.free();
    this.vm = null;
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null,
    ) => void,
  ): void {
    this.statusCallback = callback;
  }

  onCompileErrors(callback: (errors: any[]) => void): void {
    this.compileErrorsCallback = callback;
  }
}
