/* tslint:disable */
/* eslint-disable */

interface WasmError {
    message: string;
    line?: number;
    column?: number;
}

interface ResultErr {
    success: false;
    errors: WasmError[];
}

interface RunResultOk {
    success: true;
    returnValue: number | null;
    stdout: string;
    trace?: Record<string, string>;
}

type RunResult = RunResultOk | ResultErr;

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

/** コンパイルターゲット */
type CompileTarget = "ws" | "mnemonic";

/** 言語サブセット */
type LanguageStd = "standard" | "ws";

/** ターゲット拡張 */
type StdExtension = "debug" | "alloc";

/** 利用可能な最適化パス */
type OptPass = "all" | "condition-opt" | "geti-opt" | "constant-folding" | "dead-code";

/** 利用可能なオプション定義 */
interface OptionsDefinition {
    readonly compileTargets: readonly CompileTarget[];
    readonly languageStds: readonly LanguageStd[];
    readonly stdExtensions: readonly StdExtension[];
    readonly optPasses: readonly OptPass[];
}



/**
 * Whitespace VM の WASM ラッパー
 *
 * JS 側ではオペーク型として扱われ、メソッド呼び出しで状態を操作する。
 */
export class WasmWhitespaceVM {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * コールスタックの深さ
     */
    call_stack_depth(): number;
    /**
     * stdin のストリーム終端を通知する（interactive モード用）
     *
     * 以降、バッファが空の状態で入力命令に到達すると EOF として処理される。
     */
    closeStdin(): void;
    /**
     * 現在の命令のニーモニック表現を取得（デバッグ用）
     */
    current_instruction(): string | undefined;
    /**
     * 命令列全体のニーモニック表現を取得
     */
    disassemble(): string[];
    /**
     * 標準出力バッファの内容を取得しクリアする
     */
    flush_stdout(): string;
    /**
     * Whitespace ソースコードから直接 VM を構築する
     */
    static fromWhitespace(ws_source: string, stdin: string): WasmWhitespaceVM;
    /**
     * Interactive モードで Whitespace ソースから VM を構築する
     *
     * stdin バッファが空の場合、WaitingForInput で一時停止する。
     * provide_stdin() で後からデータを追加可能。
     */
    static fromWhitespaceInteractive(ws_source: string, initial_stdin: string): WasmWhitespaceVM;
    /**
     * ヒープの現在の内容
     *
     * 戻り値: { [address: string]: number }
     */
    get_heap(): Record<string, number>;
    /**
     * データスタックの現在の内容
     *
     * 戻り値: number[] (i64 → JS number に変換。53bit 超は精度が落ちる)
     */
    get_stack(): number[];
    /**
     * トレース情報を取得
     *
     * 戻り値: { [key: string]: number }
     */
    get_traced(): Record<string, number>;
    /**
     * 実行完了済みか
     */
    is_complete(): boolean;
    /**
     * nospace ソースをコンパイルし、Whitespace VM を構築する
     *
     * - `std_extensions`: 有効にする拡張の配列（例: `["debug", "alloc"]`）
     */
    constructor(nospace_source: string, stdin: string, interactive?: boolean | null, std_extensions?: StdExtension[] | null);
    /**
     * 現在のプログラムカウンタ（命令インデックス）
     */
    pc(): number;
    /**
     * stdin にデータを追加する（interactive モード用）
     *
     * WaitingForInput 状態の際に呼び出し、次の step() で入力を再試行する。
     * InputNumber の場合、改行（\n）付きで投入する必要がある。
     */
    provideStdin(data: string): void;
    /**
     * 指定ステップ数だけ実行する
     *
     * 戻り値: { status: "suspended" | "complete" | "error" | "waiting_for_input", error?: string, inputType?: string }
     */
    step(budget: number): VmStepResult;
    /**
     * 総実行命令数
     */
    total_steps(): number;
}

/**
 * nospace ソースコードをコンパイルする。
 * CLI の `--mode=compile` に相当。
 *
 * - `std_extensions`: 有効にする拡張の配列（例: `["debug", "alloc"]`）
 * - `opt_passes`: 有効にする最適化パスの配列（例: `["all"]` または `["constant-folding", "dead-code"]`）
 */
export function compile(source: string, target: string, lang_std: string, std_extensions?: StdExtension[] | null, opt_passes?: OptPass[] | null): CompileResult;

/**
 * nospace ソースコードをニーモニックにコンパイル（ヘルパー関数）
 */
export function compile_to_mnemonic_string(source: string): CompileResult;

/**
 * nospace ソースコードを Whitespace にコンパイル（ヘルパー関数）
 */
export function compile_to_whitespace_string(source: string): CompileResult;

/**
 * 利用可能なオプションの一覧を返す
 *
 * compile() や WasmWhitespaceVM で指定可能なオプション値を取得できる。
 */
export function getOptions(): OptionsDefinition;

/**
 * nospace ソースコードの構文チェックのみ行う。
 */
export function parse(source: string): ParseResult;

/**
 * nospace ソースコードを解析・実行する。
 * CLI の `--mode=run` に相当。
 *
 * - `ignore_debug`: デバッグ用組み込み関数（__assert, __trace 等）を無視する（CLI の `--ignore-debug` 相当）
 * - `opt_passes`: 有効にする最適化パスの配列（例: `["all"]` または `["constant-folding", "dead-code"]`）
 */
export function run(source: string, stdin: string, debug: boolean, ignore_debug?: boolean | null, opt_passes?: OptPass[] | null): RunResult;
