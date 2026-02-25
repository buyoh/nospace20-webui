/**
 * check.json のスキーマ型定義
 */

/** スキーマの種類 */
export type CheckResultType =
  | 'success_trace' // trace_hit_counts ベース
  | 'success_io_single' // IO 検証（単一ケース）
  | 'success_io_multi' // IO 検証（複数ケース）
  | 'compile_error' // コンパイルエラー検証
  | 'parse_error' // パースエラー検証
  | 'unknown'; // 未対応スキーマ

/**
 * 1. 成功（trace ベース検証）
 *
 * 例:
 * ```json
 * { "trace_hit_counts": [1, 1, 1] }
 * { "type": "success", "trace_hit_counts": [1] }
 * ```
 */
export interface SuccessTraceSchema {
  type?: 'success';
  trace_hit_counts: number[];
}

/**
 * 2. 成功（IO ベース検証 - 単一ケース）
 *
 * 例:
 * ```json
 * { "type": "success_io", "stdin": "ABC", "stdout": "ABC" }
 * ```
 */
export interface SuccessIOSingleSchema {
  type: 'success_io';
  stdin: string;
  stdout: string;
}

/**
 * 3. 成功（IO ベース検証 - 複数ケース）
 *
 * 例:
 * ```json
 * {
 *   "type": "success_io",
 *   "cases": [
 *     { "name": "positive", "stdin": "42\n", "stdout": "42" },
 *     { "name": "zero", "stdin": "0\n", "stdout": "0" }
 *   ]
 * }
 * ```
 */
export interface SuccessIOMultiSchema {
  type: 'success_io';
  cases: Array<{
    name: string;
    stdin: string;
    stdout: string;
  }>;
}

/** IO 検証スキーマの Union 型 */
export type SuccessIOSchema = SuccessIOSingleSchema | SuccessIOMultiSchema;

/**
 * 4. コンパイルエラー検証
 *
 * 例:
 * ```json
 * { "type": "compile_error", "contains": ["error message substring"] }
 * ```
 */
export interface CompileErrorSchema {
  type: 'compile_error';
  contains: string[];
}

/**
 * 5. パースエラー検証
 *
 * 例:
 * ```json
 * { "type": "parse_error", "phase": "tree" }
 * { "type": "parse_error", "phase": "tokenize", "contains": ["detail"] }
 * ```
 */
export interface ParseErrorSchema {
  type: 'parse_error';
  phase: 'tree' | 'tokenize';
  contains?: string[];
}

/** check.json スキーマの Union 型 */
export type CheckResultSchema =
  | SuccessTraceSchema
  | SuccessIOSingleSchema
  | SuccessIOMultiSchema
  | CompileErrorSchema
  | ParseErrorSchema;

/**
 * パース結果（型情報付き）
 */
export interface ParsedCheckResult {
  /** 判定された型 */
  resultType: CheckResultType;
  /** 構造化データ（unknown の場合は null） */
  schema: CheckResultSchema | null;
  /** 元の JSON 文字列 */
  rawJson: string;
}
