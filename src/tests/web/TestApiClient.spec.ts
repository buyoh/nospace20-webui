import {
  TestApiClient,
  encodeTestPath,
} from '../../web/services/TestApiClient';

/** 呼び出しを記録するフェイク fetch（ネットワークに接続しない） */
function createFakeFetch(response: Partial<Response> = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: true,
      statusText: 'OK',
      json: async () => ({ path: 'p', source: 's', check: null }),
      ...response,
    } as Response;
  };
  return { calls, fetchFn };
}

describe('encodeTestPath', () => {
  it('`/` は区切りとして残し、各要素をエンコードする', () => {
    expect(encodeTestPath('passes/ops/arith_001')).toBe('passes/ops/arith_001');
  });

  it('BUG: `#` `?` `%` や空白を含む要素は URL が壊れないようエンコードする', () => {
    expect(encodeTestPath('a b/c#d/e?f/g%h')).toBe('a%20b/c%23d/e%3Ff/g%25h');
  });
});

describe('TestApiClient', () => {
  it('fetchTestCase はパスをエンコードし、signal を fetch に渡す', async () => {
    const { calls, fetchFn } = createFakeFetch();
    const client = new TestApiClient(fetchFn);
    const controller = new AbortController();

    await client.fetchTestCase('dir/a#b', controller.signal);

    expect(calls[0].url).toBe('/api/tests/dir/a%23b');
    expect(calls[0].init?.signal).toBe(controller.signal);
  });

  it('updateTestCase はパスをエンコードして PUT する', async () => {
    const { calls, fetchFn } = createFakeFetch();
    const client = new TestApiClient(fetchFn);

    await client.updateTestCase('dir/a?b', { source: 's' });

    expect(calls[0].url).toBe('/api/tests/dir/a%3Fb');
    expect(calls[0].init?.method).toBe('PUT');
  });

  it('レスポンスが ok でなければ例外を投げる', async () => {
    const { fetchFn } = createFakeFetch({
      ok: false,
      statusText: 'Bad Request',
    });
    const client = new TestApiClient(fetchFn);

    await expect(client.fetchTestCase('x')).rejects.toThrow('Bad Request');
    await expect(
      client.createTestCase({ path: 'x', source: 's' })
    ).rejects.toThrow('Bad Request');
  });
});
