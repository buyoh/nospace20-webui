import {
  parseCheckResult,
  detectCheckResultType,
  serializeCheckResult,
  validateCheckResult,
  createEmptySchema,
} from '../../../web/libs/checkResultParser';

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

    it('unknown - null', () => {
      expect(detectCheckResultType(null)).toBe('unknown');
    });

    it('unknown - non-object', () => {
      expect(detectCheckResultType('string')).toBe('unknown');
    });

    it('unknown - success_io without stdin/stdout/cases', () => {
      expect(detectCheckResultType({ type: 'success_io' })).toBe('unknown');
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

    it('parses success_trace JSON with type field', () => {
      const json = '{"type":"success","trace_hit_counts":[1]}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('success_trace');
    });

    it('parses success_io_single JSON', () => {
      const json = '{"type":"success_io","stdin":"A","stdout":"A"}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('success_io_single');
    });

    it('parses success_io_multi JSON', () => {
      const json =
        '{"type":"success_io","cases":[{"name":"c1","stdin":"1","stdout":"1"}]}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('success_io_multi');
    });

    it('parses compile_error JSON', () => {
      const json = '{"type":"compile_error","contains":["error msg"]}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('compile_error');
    });

    it('parses parse_error JSON', () => {
      const json = '{"type":"parse_error","phase":"tree"}';
      const result = parseCheckResult(json);
      expect(result).not.toBeNull();
      expect(result!.resultType).toBe('parse_error');
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

    it('preserves rawJson in result', () => {
      const json = '{"trace_hit_counts":[1]}';
      const result = parseCheckResult(json);
      expect(result!.rawJson).toBe(json);
    });
  });

  describe('serializeCheckResult', () => {
    it('serializes success_trace schema', () => {
      const schema = { trace_hit_counts: [1, 2, 3] };
      const json = serializeCheckResult(schema);
      expect(json).toContain('"trace_hit_counts"');
      expect(json).toContain('[');
      expect(json).toContain('1');
    });

    it('serializes without formatting when pretty=false', () => {
      const schema = { trace_hit_counts: [1] };
      const json = serializeCheckResult(schema, false);
      expect(json).toBe('{"trace_hit_counts":[1]}');
    });

    it('serializes with formatting when pretty=true (default)', () => {
      const schema = { trace_hit_counts: [1] };
      const json = serializeCheckResult(schema);
      expect(json).toContain('\n');
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

    it('validates success_io_multi schema - valid', () => {
      const schema = {
        type: 'success_io' as const,
        cases: [{ name: 'c1', stdin: 'in', stdout: 'out' }],
      };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates success_io_multi schema - empty cases', () => {
      const schema = { type: 'success_io' as const, cases: [] };
      const errors = validateCheckResult(schema);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates compile_error schema - valid', () => {
      const schema = { type: 'compile_error' as const, contains: ['error'] };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates compile_error schema - empty contains', () => {
      const schema = { type: 'compile_error' as const, contains: [] };
      const errors = validateCheckResult(schema);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates parse_error schema - valid tree', () => {
      const schema = { type: 'parse_error' as const, phase: 'tree' as const };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates parse_error schema - valid tokenize with contains', () => {
      const schema = {
        type: 'parse_error' as const,
        phase: 'tokenize' as const,
        contains: ['detail'],
      };
      expect(validateCheckResult(schema)).toEqual([]);
    });

    it('validates parse_error schema - invalid phase', () => {
      const schema = { type: 'parse_error' as const, phase: 'invalid' as 'tree' };
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
      expect((schema as { cases: unknown[] }).cases).toHaveLength(1);
    });

    it('creates empty compile_error schema', () => {
      const schema = createEmptySchema('compile_error');
      expect(schema).toEqual({ type: 'compile_error', contains: [''] });
    });

    it('creates empty parse_error schema', () => {
      const schema = createEmptySchema('parse_error');
      expect(schema).toEqual({ type: 'parse_error', phase: 'tree' });
    });

    it('returns null for unknown type', () => {
      const schema = createEmptySchema('unknown');
      expect(schema).toBeNull();
    });
  });
});
