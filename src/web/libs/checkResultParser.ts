import {
  CheckResultType,
  CheckResultSchema,
  SuccessIOSingleSchema,
  SuccessIOMultiSchema,
  CompileErrorSchema,
  ParseErrorSchema,
  ParsedCheckResult,
} from '../../interfaces/CheckResultSchema';

/**
 * JSON 文字列から check.json スキーマを解析
 *
 * @param json - JSON 文字列
 * @returns 解析結果。パース失敗時は null
 */
export function parseCheckResult(json: string): ParsedCheckResult | null {
  try {
    const obj = JSON.parse(json);
    const resultType = detectCheckResultType(obj);

    if (resultType === 'unknown') {
      return {
        resultType: 'unknown',
        schema: null,
        rawJson: json,
      };
    }

    return {
      resultType,
      schema: obj as CheckResultSchema,
      rawJson: json,
    };
  } catch (_error) {
    // JSON 構文エラー
    return null;
  }
}

/**
 * オブジェクトから check.json の型を自動判定
 *
 * 判定の優先順位:
 * 1. trace_hit_counts フィールドの有無（最優先）
 * 2. type フィールドの値
 * 3. 追加のフィールド（cases, stdin, stdout, contains, phase）
 *
 * @param obj - JSON.parse() した結果
 * @returns 判定された型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectCheckResultType(obj: any): CheckResultType {
  if (!obj || typeof obj !== 'object') {
    return 'unknown';
  }

  // 1. trace_hit_counts があれば success_trace
  if (Array.isArray(obj.trace_hit_counts)) {
    return 'success_trace';
  }

  // 2. type フィールドで判定
  if (obj.type === 'success_io') {
    // 2-1. cases 配列があれば success_io_multi
    if (Array.isArray(obj.cases)) {
      return 'success_io_multi';
    }
    // 2-2. stdin/stdout があれば success_io_single
    if ('stdin' in obj && 'stdout' in obj) {
      return 'success_io_single';
    }
    return 'unknown';
  }

  if (obj.type === 'compile_error' && Array.isArray(obj.contains)) {
    return 'compile_error';
  }

  if (obj.type === 'parse_error' && typeof obj.phase === 'string') {
    return 'parse_error';
  }

  return 'unknown';
}

/**
 * check.json スキーマを JSON 文字列に変換
 *
 * @param schema - 構造化スキーマ
 * @param pretty - 整形するか（デフォルト: true）
 * @returns JSON 文字列
 */
export function serializeCheckResult(
  schema: CheckResultSchema,
  pretty: boolean = true,
): string {
  if (pretty) {
    return JSON.stringify(schema, null, 2);
  }
  return JSON.stringify(schema);
}

/**
 * check.json スキーマをバリデーション
 *
 * @param schema - 構造化スキーマ
 * @returns エラーメッセージ配列（問題なければ空配列）
 */
export function validateCheckResult(schema: CheckResultSchema): string[] {
  const errors: string[] = [];

  // SuccessTraceSchema
  if ('trace_hit_counts' in schema) {
    const counts = schema.trace_hit_counts;
    if (!Array.isArray(counts) || counts.length === 0) {
      errors.push('trace_hit_counts must be a non-empty array');
    } else {
      counts.forEach((count, index) => {
        if (!Number.isInteger(count) || count < 0) {
          errors.push(
            `trace_hit_counts[${index}] must be a non-negative integer`,
          );
        }
      });
    }
  }

  // SuccessIOSingleSchema（cases がない場合）
  if ('stdin' in schema && !('cases' in schema)) {
    const s = schema as SuccessIOSingleSchema;
    if (typeof s.stdin !== 'string') {
      errors.push('stdin must be a string');
    }
    if (typeof s.stdout !== 'string') {
      errors.push('stdout must be a string');
    }
  }

  // SuccessIOMultiSchema
  if ('cases' in schema) {
    const s = schema as SuccessIOMultiSchema;
    if (!Array.isArray(s.cases) || s.cases.length === 0) {
      errors.push('cases must be a non-empty array');
    } else {
      s.cases.forEach((testCase, index) => {
        if (!testCase.name || typeof testCase.name !== 'string') {
          errors.push(`cases[${index}].name must be a non-empty string`);
        }
        if (typeof testCase.stdin !== 'string') {
          errors.push(`cases[${index}].stdin must be a string`);
        }
        if (typeof testCase.stdout !== 'string') {
          errors.push(`cases[${index}].stdout must be a string`);
        }
      });
    }
  }

  // CompileErrorSchema
  if (schema.type === 'compile_error') {
    const s = schema as CompileErrorSchema;
    if (!Array.isArray(s.contains) || s.contains.length === 0) {
      errors.push('contains must be a non-empty array');
    } else {
      s.contains.forEach((str, index) => {
        if (typeof str !== 'string') {
          errors.push(`contains[${index}] must be a string`);
        }
      });
    }
  }

  // ParseErrorSchema
  if (schema.type === 'parse_error') {
    const s = schema as ParseErrorSchema;
    if (s.phase !== 'tree' && s.phase !== 'tokenize') {
      errors.push('phase must be "tree" or "tokenize"');
    }
    if (s.contains !== undefined) {
      if (!Array.isArray(s.contains)) {
        errors.push('contains must be an array');
      } else {
        s.contains.forEach((str, index) => {
          if (typeof str !== 'string') {
            errors.push(`contains[${index}] must be a string`);
          }
        });
      }
    }
  }

  return errors;
}

/**
 * 空のスキーマを生成（新規作成時のデフォルト値）
 *
 * @param type - スキーマの型
 * @returns 初期化されたスキーマ（unknown の場合は null）
 */
export function createEmptySchema(type: CheckResultType): CheckResultSchema | null {
  switch (type) {
    case 'success_trace':
      return { trace_hit_counts: [1] };
    case 'success_io_single':
      return { type: 'success_io', stdin: '', stdout: '' };
    case 'success_io_multi':
      return {
        type: 'success_io',
        cases: [{ name: 'case1', stdin: '', stdout: '' }],
      };
    case 'compile_error':
      return { type: 'compile_error', contains: [''] };
    case 'parse_error':
      return { type: 'parse_error', phase: 'tree' };
    default:
      return null;
  }
}
