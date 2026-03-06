// Unit test for formatNospaceErrors utility

import {
  formatErrorEntries,
  tryFormatNospaceErrorJson,
  isNospaceErrorResult,
  tryParseNospaceErrors,
} from '../../web/libs/formatNospaceErrors';

describe('formatErrorEntries', () => {
  it('should format a single error without location', () => {
    const result = formatErrorEntries([
      { message: 'undefined function: sdf__puti' },
    ]);
    expect(result).toBe('undefined function: sdf__puti');
  });

  it('should format a single error with line', () => {
    const result = formatErrorEntries([{ message: 'syntax error', line: 5 }]);
    expect(result).toBe('syntax error:5');
  });

  it('should format a single error with line and column', () => {
    const result = formatErrorEntries([
      { message: 'syntax error', line: 5, column: 3 },
    ]);
    expect(result).toBe('syntax error:5:3');
  });

  it('should join multiple errors with newline', () => {
    const result = formatErrorEntries([
      { message: 'error one' },
      { message: 'error two', line: 10 },
    ]);
    expect(result).toBe('error one\nerror two:10');
  });

  it('should return empty string for empty array', () => {
    const result = formatErrorEntries([]);
    expect(result).toBe('');
  });

  it('should include details on a new indented line', () => {
    const result = formatErrorEntries([
      {
        message: 'type mismatch',
        line: 3,
        column: 1,
        details: 'expected int, got string',
      },
    ]);
    expect(result).toBe('type mismatch:3:1\n  expected int, got string');
  });

  it('should include details without location', () => {
    const result = formatErrorEntries([
      { message: 'internal error', details: 'stack overflow' },
    ]);
    expect(result).toBe('internal error\n  stack overflow');
  });
});

describe('tryFormatNospaceErrorJson', () => {
  it('should format valid error JSON', () => {
    const json =
      '{"success":false,"errors":[{"message":"undefined function: sdf__puti"}]}';
    const result = tryFormatNospaceErrorJson(json);
    expect(result).toBe('undefined function: sdf__puti');
  });

  it('should format error JSON with location info', () => {
    const json = JSON.stringify({
      success: false,
      errors: [{ message: 'syntax error', line: 5, column: 3 }],
    });
    const result = tryFormatNospaceErrorJson(json);
    expect(result).toBe('syntax error:5:3');
  });

  it('should format multiple errors', () => {
    const json = JSON.stringify({
      success: false,
      errors: [{ message: 'error one' }, { message: 'error two', line: 10 }],
    });
    const result = tryFormatNospaceErrorJson(json);
    expect(result).toBe('error one\nerror two:10');
  });

  it('should return null for non-JSON text', () => {
    expect(tryFormatNospaceErrorJson('plain error text')).toBeNull();
  });

  it('should return null for JSON with success=true', () => {
    const json = JSON.stringify({ success: true, output: 'ok' });
    expect(tryFormatNospaceErrorJson(json)).toBeNull();
  });

  it('should return null for JSON without errors array', () => {
    const json = JSON.stringify({ success: false });
    expect(tryFormatNospaceErrorJson(json)).toBeNull();
  });

  it('should return null for JSON with invalid error entries', () => {
    const json = JSON.stringify({ success: false, errors: [{ foo: 'bar' }] });
    expect(tryFormatNospaceErrorJson(json)).toBeNull();
  });

  it('should return null for non-object JSON', () => {
    expect(tryFormatNospaceErrorJson('"just a string"')).toBeNull();
    expect(tryFormatNospaceErrorJson('42')).toBeNull();
    expect(tryFormatNospaceErrorJson('null')).toBeNull();
  });
});

describe('isNospaceErrorResult', () => {
  it('should return true for valid ResultErr object', () => {
    expect(
      isNospaceErrorResult({
        success: false,
        errors: [{ message: 'error' }],
      })
    ).toBe(true);
  });

  it('should return true for ResultErr with location info', () => {
    expect(
      isNospaceErrorResult({
        success: false,
        errors: [{ message: 'error', line: 1, column: 2 }],
      })
    ).toBe(true);
  });

  it('should return false for success=true', () => {
    expect(isNospaceErrorResult({ success: true, output: 'ok' })).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isNospaceErrorResult(null)).toBe(false);
    expect(isNospaceErrorResult(undefined)).toBe(false);
    expect(isNospaceErrorResult('string')).toBe(false);
    expect(isNospaceErrorResult(42)).toBe(false);
  });

  it('should return false for object without errors array', () => {
    expect(isNospaceErrorResult({ success: false })).toBe(false);
  });

  it('should return false for errors without message field', () => {
    expect(
      isNospaceErrorResult({ success: false, errors: [{ foo: 'bar' }] })
    ).toBe(false);
  });
});

describe('tryParseNospaceErrors', () => {
  it('tryParseNospaceErrors で JSON エラーをパースする', () => {
    const json = JSON.stringify({
      success: false,
      errors: [{ message: 'undefined function: foo', line: 3, column: 1 }],
    });
    const result = tryParseNospaceErrors(json);
    expect(result).toEqual([
      { message: 'undefined function: foo', line: 3, column: 1 },
    ]);
  });

  it('tryParseNospaceErrors で複数エラーをパースする', () => {
    const json = JSON.stringify({
      success: false,
      errors: [{ message: 'error one' }, { message: 'error two', line: 10 }],
    });
    const result = tryParseNospaceErrors(json);
    expect(result).toEqual([
      { message: 'error one' },
      { message: 'error two', line: 10 },
    ]);
  });

  it('tryParseNospaceErrors で非 JSON を null に返す', () => {
    expect(tryParseNospaceErrors('plain error text')).toBeNull();
  });

  it('tryParseNospaceErrors で不正なフォーマット（success=true）を null に返す', () => {
    const json = JSON.stringify({ success: true, output: 'ok' });
    expect(tryParseNospaceErrors(json)).toBeNull();
  });

  it('tryParseNospaceErrors で errors 配列なしを null に返す', () => {
    const json = JSON.stringify({ success: false });
    expect(tryParseNospaceErrors(json)).toBeNull();
  });

  it('tryParseNospaceErrors で message なしエラーを null に返す', () => {
    const json = JSON.stringify({ success: false, errors: [{ foo: 'bar' }] });
    expect(tryParseNospaceErrors(json)).toBeNull();
  });
});
