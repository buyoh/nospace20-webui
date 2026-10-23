import {
  RequestValidator,
  readRequestId,
} from '../../app/Controllers/RequestValidator';

const runPayload = (overrides: Record<string, unknown> = {}) => ({
  requestId: 'req-1',
  code: 'print 1',
  options: {
    language: 'standard',
    inputMode: 'batch',
    debug: true,
    stdExtensions: ['alloc', 'debug'],
  },
  stdinData: '1\n',
  ...overrides,
});

describe('RequestValidator.parseRun', () => {
  it('正しい payload を正規化して返す', () => {
    const result = RequestValidator.parseRun(runPayload());

    expect(result).toEqual({
      ok: true,
      value: {
        requestId: 'req-1',
        code: 'print 1',
        options: {
          language: 'standard',
          inputMode: 'batch',
          debug: true,
          strictHeap: false,
          randomizeHeap: false,
          stdExtensions: ['alloc', 'debug'],
          optPasses: [],
        },
        stdinData: '1\n',
      },
    });
  });

  it('strictHeap / randomizeHeap / maxMemoryCells を受け取る', () => {
    const result = RequestValidator.parseRun(
      runPayload({
        options: {
          language: 'ws',
          inputMode: 'batch',
          strictHeap: true,
          randomizeHeap: true,
          maxMemoryCells: 0,
        },
      })
    );

    expect(result.ok && result.value.options).toMatchObject({
      strictHeap: true,
      randomizeHeap: true,
      maxMemoryCells: 0,
    });
  });

  it.each([
    ['負数', -1],
    ['小数', 1.5],
    ['u32 を超える値', 4294967296],
    ['NaN', NaN],
    ['文字列', '100'],
  ])('maxMemoryCells が %s なら拒否する', (_label, maxMemoryCells) => {
    const result = RequestValidator.parseRun(
      runPayload({
        options: { language: 'ws', inputMode: 'batch', maxMemoryCells },
      })
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('maxMemoryCells');
  });

  it('boolean でない debug / strictHeap / randomizeHeap は false にする', () => {
    const result = RequestValidator.parseRun(
      runPayload({
        options: {
          language: 'min',
          inputMode: 'interactive',
          debug: 'yes',
          strictHeap: 1,
          randomizeHeap: 'yes',
        },
      })
    );

    expect(result.ok && result.value.options).toMatchObject({
      debug: false,
      strictHeap: false,
      randomizeHeap: false,
    });
  });

  it.each([
    ['payload が undefined', undefined],
    ['payload が null', null],
    ['payload が文字列', 'x'],
    ['requestId が無い', runPayload({ requestId: undefined })],
    ['requestId が空', runPayload({ requestId: '' })],
    ['requestId が長すぎる', runPayload({ requestId: 'x'.repeat(65) })],
  ])(
    '通知先を特定できない不正 payload（%s）は requestId: null で失敗する',
    (_n, payload) => {
      const result = RequestValidator.parseRun(payload);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.requestId).toBeNull();
    }
  );

  it.each([
    ['code が数値', { code: 1 }],
    ['options が無い', { options: undefined }],
    ['stdinData が数値', { stdinData: 5 }],
    ['language が許可外', { options: { language: 'x', inputMode: 'batch' } }],
    ['inputMode が許可外', { options: { language: 'ws', inputMode: 'x' } }],
    [
      'stdExtensions が先頭 -',
      {
        options: {
          language: 'ws',
          inputMode: 'batch',
          stdExtensions: ['-x'],
        },
      },
    ],
    [
      'stdExtensions が多すぎる',
      {
        options: {
          language: 'ws',
          inputMode: 'batch',
          stdExtensions: Array.from({ length: 17 }, () => 'a'),
        },
      },
    ],
    [
      'optPasses が配列でない',
      { options: { language: 'ws', inputMode: 'batch', optPasses: 'x' } },
    ],
  ])('%s の場合は requestId 付きで失敗する', (_name, overrides) => {
    const result = RequestValidator.parseRun(runPayload(overrides));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.requestId).toBe('req-1');
  });
});

describe('RequestValidator.parseCompile', () => {
  const compilePayload = (options: Record<string, unknown>) => ({
    requestId: 'req-2',
    code: 'c',
    options,
  });

  it('target を許可リストで検証し、欠けたリストは空配列にする', () => {
    const result = RequestValidator.parseCompile(
      compilePayload({ language: 'standard', target: 'ex-ws' })
    );

    expect(result.ok && result.value.options).toEqual({
      language: 'standard',
      target: 'ex-ws',
      stdExtensions: [],
      optPasses: [],
    });
  });

  it('許可されない target は失敗する', () => {
    const result = RequestValidator.parseCompile(
      compilePayload({ language: 'standard', target: 'exe' })
    );

    expect(result.ok).toBe(false);
  });
});

describe('RequestValidator.parseStdin / parseKill', () => {
  it('sessionId と data が文字列なら成功する', () => {
    expect(RequestValidator.parseStdin({ sessionId: 's', data: 'x' }).ok).toBe(
      true
    );
    expect(RequestValidator.parseKill({ sessionId: 's' }).ok).toBe(true);
  });

  it('型違い・欠落は失敗する', () => {
    expect(RequestValidator.parseStdin({ sessionId: 1, data: 'x' }).ok).toBe(
      false
    );
    expect(RequestValidator.parseStdin({ sessionId: 's', data: {} }).ok).toBe(
      false
    );
    expect(RequestValidator.parseStdin(undefined).ok).toBe(false);
    expect(RequestValidator.parseKill({}).ok).toBe(false);
    expect(RequestValidator.parseKill(null).ok).toBe(false);
  });
});

describe('readRequestId', () => {
  it('有効な requestId のみ返す', () => {
    expect(readRequestId({ requestId: 'a' })).toBe('a');
    expect(readRequestId({ requestId: 1 })).toBeNull();
    expect(readRequestId(undefined)).toBeNull();
  });
});
