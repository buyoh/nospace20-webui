/* tslint:disable */
/* eslint-disable */

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
    disassemble(): any;
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
    get_heap(): any;
    /**
     * データスタックの現在の内容
     *
     * 戻り値: number[] (i64 → JS number に変換。53bit 超は精度が落ちる)
     */
    get_stack(): any;
    /**
     * トレース情報を取得
     *
     * 戻り値: { [key: string]: number }
     */
    get_traced(): any;
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
    step(budget: number): any;
    /**
     * 総実行命令数
     */
    total_steps(): number;
}

/**
 * nospace ソースコードをコンパイルする。
 * CLI の `--mode=compile` に相当。
 */
export function compile(source: string, target: string, lang_std: string): any;

/**
 * nospace ソースコードをニーモニックにコンパイル（ヘルパー関数）
 */
export function compile_to_mnemonic_string(source: string): any;

/**
 * nospace ソースコードを Whitespace にコンパイル（ヘルパー関数）
 */
export function compile_to_whitespace_string(source: string): any;

/**
 * nospace ソースコードの構文チェックのみ行う。
 */
export function parse(source: string): any;

/**
 * nospace ソースコードを解析・実行する。
 * CLI の `--mode=run` に相当。
 */
export function run(source: string, stdin: string, debug: boolean): any;
