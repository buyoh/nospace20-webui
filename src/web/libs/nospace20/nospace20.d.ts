/* tslint:disable */
/* eslint-disable */

interface WasmError {
    message: string;
    line?: number;
    column?: number;
    details?: string;
}

interface ResultErr {
    success: false;
    errors: WasmError[];
}

interface CompileResultOk {
    success: true;
    output: string;
}

type CompileResult = CompileResultOk | ResultErr;

interface ParseResultOk {
    success: true;
}

type ParseResult = ParseResultOk | ResultErr;

interface VmStepResult {
    status: "suspended" | "complete" | "error" | "waiting_for_input";
    error?: string;
    inputType?: "char" | "number";
}

/** Compile target */
type CompileTarget = "ws" | "mnemonic";

/** Language subset */
type LanguageStd = "standard" | "ws";

/** Target extensions */
type StdExtension = "debug" | "alloc";

/** Available optimization passes */
type OptPass = "all" | "condition-opt" | "geti-opt" | "constant-folding" | "dead-code";

/** Available options definition */
interface OptionsDefinition {
    readonly compileTargets: readonly CompileTarget[];
    readonly languageStds: readonly LanguageStd[];
    readonly stdExtensions: readonly StdExtension[];
    readonly optPasses: readonly OptPass[];
}



/**
 * WASM wrapper for NospaceVM
 *
 * Treated as an opaque type on the JS side; manipulate state via method calls.
 * Provides the same interface pattern as `WasmWhitespaceVM`.
 */
export class WasmNospaceVM {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Get and clear stdout buffer contents
     */
    flushStdout(): string;
    /**
     * Get return value (only valid when complete)
     */
    getReturnValue(): bigint | undefined;
    /**
     * Get trace information
     *
     * Returns: { [key: string]: number }
     */
    getTraced(): any;
    /**
     * Whether execution is complete
     */
    is_complete(): boolean;
    /**
     * Construct VM from nospace source code
     *
     * - `stdin`: Contents of standard input
     * - `opt_passes`: Array of optimization passes (optional; e.g., `["all"]`)
     * - `ignore_debug`: Whether to ignore debug built-in functions (optional, defaults to false)
     */
    constructor(source: string, stdin: string, opt_passes?: OptPass[] | null, ignore_debug?: boolean | null);
    /**
     * Execute specified number of steps
     *
     * Returns: VmStepResult ({ status: "suspended" | "complete" | "error", error?: string })
     */
    step(budget: number): VmStepResult;
    /**
     * Total number of expression evaluations
     */
    total_steps(): number;
}

/**
 * WASM wrapper for Whitespace VM
 *
 * Treated as an opaque type on the JS side; manipulate state via method calls.
 */
export class WasmWhitespaceVM {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Depth of call stack
     */
    call_stack_depth(): number;
    /**
     * Notify end of stdin stream (for interactive mode)
     *
     * After this, if an input instruction is reached with an empty buffer, it will be treated as EOF.
     */
    closeStdin(): void;
    /**
     * Get mnemonic representation of current instruction (for debugging)
     */
    current_instruction(): string | undefined;
    /**
     * Get mnemonic representation of entire instruction sequence
     */
    disassemble(): string[];
    /**
     * Get and clear stdout buffer contents
     */
    flush_stdout(): string;
    /**
     * Construct VM directly from Whitespace source code
     */
    static fromWhitespace(ws_source: string, stdin: string): WasmWhitespaceVM;
    /**
     * Construct VM from Whitespace source in interactive mode
     *
     * When stdin buffer is empty, suspends with WaitingForInput.
     * Can add data later with provide_stdin().
     */
    static fromWhitespaceInteractive(ws_source: string, initial_stdin: string): WasmWhitespaceVM;
    /**
     * Current contents of heap
     *
     * Returns: { [address: string]: number }
     */
    get_heap(): Record<string, number>;
    /**
     * Current contents of data stack
     *
     * Returns: number[] (i64 → JS number conversion. Precision drops for values > 53 bits)
     */
    get_stack(): number[];
    /**
     * Get trace information
     *
     * Returns: { [key: string]: number }
     */
    get_traced(): any;
    /**
     * Whether execution is complete
     */
    is_complete(): boolean;
    /**
     * Compile nospace source and construct Whitespace VM
     *
     * - `std_extensions`: Array of extensions to enable (e.g., `["debug", "alloc"]`)
     */
    constructor(nospace_source: string, stdin: string, interactive?: boolean | null, std_extensions?: StdExtension[] | null);
    /**
     * Current program counter (instruction index)
     */
    pc(): number;
    /**
     * Add data to stdin (for interactive mode)
     *
     * Call when in WaitingForInput state to retry input on next step().
     * For InputNumber, must provide with newline (\n).
     */
    provideStdin(data: string): void;
    /**
     * Execute specified number of steps
     *
     * Returns: { status: "suspended" | "complete" | "error" | "waiting_for_input", error?: string, inputType?: string }
     */
    step(budget: number): VmStepResult;
    /**
     * Total number of instructions executed
     */
    total_steps(): number;
}

/**
 * Compile nospace source code.
 * Equivalent to CLI's `--mode=compile`.
 *
 * - `std_extensions`: Array of extensions to enable (e.g., `["debug", "alloc"]`)
 * - `opt_passes`: Array of optimization passes to enable (e.g., `["all"]` or `["constant-folding", "dead-code"]`)
 */
export function compile(source: string, target: string, lang_std: string, std_extensions?: StdExtension[] | null, opt_passes?: OptPass[] | null): CompileResult;

/**
 * Return a list of available options
 *
 * Get option values that can be specified in compile() or WasmWhitespaceVM.
 */
export function getOptions(): OptionsDefinition;

/**
 * Perform only syntax checking on nospace source code.
 */
export function parse(source: string): ParseResult;
