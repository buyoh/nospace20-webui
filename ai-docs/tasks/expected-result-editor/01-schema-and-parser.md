# Expected Result: スキーマ定義とパーサー

## 概要

`.check.json` ファイルの多様なスキーマを TypeScript 型として定義し、JSON 文字列との相互変換を行うパーサー・シリアライザを実装する。

## ファイル構成

### 新規ファイル

| ファイル | 説明 |
|---------|------|
| `src/interfaces/CheckResultSchema.ts` | check.json のスキーマ型定義 |
| `src/web/libs/checkResultParser.ts` | パーサー・シリアライザ実装 |
| `src/tests/web/libs/checkResultParser.test.ts` | ユニットテスト |

## スキーマ型定義

### `src/interfaces/CheckResultSchema.ts`

```typescript
/**
 * check.json のスキーマ型定義
 */

/** スキーマの種類 */
export type CheckResultType = 
  | 'success_trace'     // trace_hit_counts ベース
  | 'success_io_single' // IO 検証（単一ケース）
  | 'success_io_multi'  // IO 検証（複数ケース）
  | 'compile_error'     // コンパイルエラー検証
  | 'parse_error'       // パースエラー検証
  | 'unknown';          // 未対応スキーマ

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
```

## パーサー・シリアライザ実装

### `src/web/libs/checkResultParser.ts`

```typescript
import {
  CheckResultType,
  CheckResultSchema,
  SuccessTraceSchema,
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
  } catch (error) {
    // JSON 構文エラー
    return null;
  }
}

/**
 * オブジェクトから check.json の型を自動判定
 * 
 * @param obj - JSON.parse() した結果
 * @returns 判定された型
 */
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
  pretty: boolean = true
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

  // 共通: type が正しく設定されているか（型判定後なので不要かもしれない）

  // SuccessTraceSchema
  if ('trace_hit_counts' in schema) {
    const counts = schema.trace_hit_counts;
    if (!Array.isArray(counts) || counts.length === 0) {
      errors.push('trace_hit_counts must be a non-empty array');
    } else {
      counts.forEach((count, index) => {
        if (!Number.isInteger(count) || count < 0) {
          errors.push(
            `trace_hit_counts[${index}] must be a non-negative integer`
          );
        }
      });
    }
  }

  // SuccessIOSingleSchema
  if ('stdin' in schema && 'cases' not in schema) {
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
 * @returns 初期化されたスキーマ
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
```

## ユニットテスト

### `src/tests/web/libs/checkResultParser.test.ts`

```typescript
import {
  parseCheckResult,
  detectCheckResultType,
  serializeCheckResult,
  validateCheckResult,
  createEmptySchema,
} from '../../../web/libs/checkResultParser';
import { CheckResultType } from '../../../interfaces/CheckResultSchema';

describe('checkResultParser', () => {
  describe('detectCheckResultType', () => {
    it('success_trace - trace_hit_counts only', () => {
      const obj = { trace_hit_counts: [1, 1, 1] };
      expect(detectCheckResultType(obj)).toBe('success_trace');
    });

    it('success_trace - type=success + trace_hit_counts', () => {
      const obj = { type: 'success', trace_hit_counts: [1] };
      expect(detectCheckResultType(obj)).toBe('success_trace');
    });

    it('success_io_single - type=success_io + stdin/stdout', () => {
      const obj = { type: 'success_io', stdin: 'ABC', stdout: 'ABC' };
      expect(detectCheckResultType(obj)).toBe('success_io_single');
    });

    it('success_io_multi - type=success_io + cases', () => {
      const obj = {
        type: 'success_io',
        cases: [{ name: 'test', stdin: '1', stdout: '1' }],
      };
      expect(detectCheckResultType(obj)).toBe('success_io_multi');
    });

    it('compile_error - type=compile_error + contains', () => {
      const obj = { type: 'compile_error', contains: ['error'] };
      expect(detectCheckResultType(obj)).toBe('compile_error');
    });

    it('parse_error - type=parse_error + phase', () => {
      const obj = { type: 'parse_error', phase: 'tree' };
      expect(detectCheckResultType(obj)).toBe('parse_error');
    });

    it('unknown - empty object', () => {
      expect(detectCheckResultType({})).toBe('unknown');
    });

    it('unknown - invalid type', () => {
      expect(detectCheckResultType({ type: 'invalid' })).toBe('unknown');
    });
  });

  describe('parseCheckResult', () => {
    it('parses success_trace JSON', () => {
      const json = '{"trace_hit_counts": [1, 2, 3]}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('success_trace');
      expect(result!.schema).toEqual({ trace_hit_counts: [1, 2, 3] });
    });

    it('parses success_io_single JSON', () => {
      const json = '{"type":"success_io","stdin":"A","stdout":"A"}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('success_io_single');
    });

    it('returns null for invalid JSON', () => {
      const result = parseCheckResult('{ invalid json }');
      expect(result).toBeNull();
    });

    it('returns unknown for unrecognized schema', () => {
      const json = '{"unknown_field": 123}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('unknown');
      expect(result!.schema).toBeNull();
    });
  });

  describe('serializeCheckResult', () => {
    it('serializes success_trace schema', () => {
      const schema = { trace_hit_counts: [1, 2, 3] };
      const json = serializeCheckResult(schema);
      expect(json).toContain('"trace_hit_counts"');
      expect(json).toContain('[1, 2, 3]');
    });

    it('serializes without formatting when pretty=false', () => {
      const schema = { trace_hit_counts: [1] };
      const json = serializeCheckResult(schema, false);
      expect(json).toBe('{"trace_hit_counts":[1]}');
    });
  });

  describe('validateCheckResult', () => {
    it('validates success_trace schema - valid', () => {
      const schema = { trace_hit_counts: [1, 2, 3] };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates success_trace schema - empty array', () => {
      const schema = { trace_hit_counts: [] };
      const errors = validateCheckResult(schema);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('non-empty array');
    });

    it('validates success_trace schema - negative number', () => {
      const schema = { trace_hit_counts: [1, -1, 3] };
      const errors = validateCheckResult(schema);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('non-negative integer');
    });

    it('validates success_io_single schema - valid', () => {
      const schema = { type: 'success_io' as const, stdin: 'A', stdout: 'B' };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates compile_error schema - valid', () => {
      const schema = { type: 'compile_error' as const, contains: ['error'] };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates parse_error schema - invalid phase', () => {
      const schema = { type: 'parse_error' as const, phase: 'invalid' as any };
      const errors = validateCheckResult(schema);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('phase');
    });
  });

  describe('createEmptySchema', () => {
    it('creates empty success_trace schema', () => {
      const schema = createEmptySchema('success_trace');
      expect(schema).toEqual({ trace_hit_counts: [1] });
    });

    it('creates empty success_io_single schema', () => {
      const schema = createEmptySchema('success_io_single');
      expect(schema).toEqual({ type: 'success_io', stdin: '', stdout: '' });
    });

    it('creates empty success_io_multi schema', () => {
      const schema = createEmptySchema('success_io_multi');
      expect(schema).toHaveProperty('cases');
      expect((schema as any).cases).toHaveLength(1);
    });

    it('returns null for unknown type', () => {
      const schema = createEmptySchema('unknown');
      expect(schema).toBeNull();
    });
  });
});
```

## 実装メモ

### バリデーションの注意点

- `trace_hit_counts` は非負整数の配列
- `cases` の `name` は空でない文字列
- `phase` は `"tree"` または `"tokenize"` のみ

### 型判定の優先順位

1. `trace_hit_counts` フィールドの有無（最優先）
2. `type` フィールドの値
3. 追加のフィールド（`cases`, `stdin`, `stdout`, `contains`, `phase`）

### エラーハンドリング

- JSON 構文エラー: `parseCheckResult()` は `null` を返す
- 未対応スキーマ: `resultType = 'unknown'`、`schema = null`
- バリデーションエラー: `validateCheckResult()` がエラーメッセージ配列を返す
