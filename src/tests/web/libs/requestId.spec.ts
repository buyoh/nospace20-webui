import { createDefaultRequestIdGenerator } from '../../../web/libs/requestId';

describe('createDefaultRequestIdGenerator', () => {
  it('randomUUID が使える場合はそれを使う', () => {
    const generate = createDefaultRequestIdGenerator({
      randomUUID: () => 'uuid-from-crypto',
    });

    expect(generate()).toBe('uuid-from-crypto');
  });

  it('BUG: randomUUID が使えない環境（secure context 外）でも例外を投げず、一意な識別子を返す', () => {
    const generate = createDefaultRequestIdGenerator({});

    const ids = new Set([generate(), generate(), generate()]);

    expect(ids.size).toBe(3);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it('crypto 自体が無い場合もフォールバックする', () => {
    // 引数に undefined を明示しても既定値（globalThis.crypto）にならないよう、空オブジェクト相当を渡す
    const generate = createDefaultRequestIdGenerator({ randomUUID: undefined });

    expect(typeof generate()).toBe('string');
  });
});
