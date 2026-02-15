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
    status: "suspended" | "complete" | "error";
    error?: string;
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
     */
    constructor(nospace_source: string, stdin: string);
    /**
     * 現在のプログラムカウンタ（命令インデックス）
     */
    pc(): number;
    /**
     * 指定ステップ数だけ実行する
     *
     * 戻り値: { status: "suspended" | "complete" | "error", error?: string }
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
 */
export function compile(source: string, target: string, lang_std: string): CompileResult;

/**
 * nospace ソースコードをニーモニックにコンパイル（ヘルパー関数）
 */
export function compile_to_mnemonic_string(source: string): CompileResult;

/**
 * nospace ソースコードを Whitespace にコンパイル（ヘルパー関数）
 */
export function compile_to_whitespace_string(source: string): CompileResult;

/**
 * nospace ソースコードの構文チェックのみ行う。
 */
export function parse(source: string): ParseResult;

/**
 * nospace ソースコードを解析・実行する。
 * CLI の `--mode=run` に相当。
 */
export function run(source: string, stdin: string, debug: boolean): RunResult;
