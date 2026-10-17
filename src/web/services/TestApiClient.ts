import type {
  TestTreeResponse,
  TestCaseResponse,
  TestCaseUpdateRequest,
  TestCaseCreateRequest,
} from '../../interfaces/TestTypes';

/** fetch の型（テスト時に差し替えるため DI できるようにする） */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * テストケースのパスを URL に埋め込める形にする。
 * `#` `?` `%` などを含む名前で URL が壊れないよう、要素ごとにエンコードする（`/` は区切りとして残す）。
 */
export function encodeTestPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * テスト管理APIのクライアント
 */
export class TestApiClient {
  constructor(
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init)
  ) {}

  /**
   * テストツリーを取得
   */
  async fetchTree(): Promise<TestTreeResponse> {
    const response = await this.fetchFn('/api/tests', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tree: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * テストケースの詳細を取得
   */
  async fetchTestCase(
    path: string,
    signal?: AbortSignal
  ): Promise<TestCaseResponse> {
    const response = await this.fetchFn(`/api/tests/${encodeTestPath(path)}`, {
      signal,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch test case: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * テストケースを更新
   */
  async updateTestCase(
    path: string,
    data: TestCaseUpdateRequest
  ): Promise<void> {
    const response = await this.fetchFn(`/api/tests/${encodeTestPath(path)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update test case: ${response.statusText}`);
    }
  }

  /**
   * テストケースを作成
   */
  async createTestCase(data: TestCaseCreateRequest): Promise<void> {
    const response = await this.fetchFn('/api/tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create test case: ${response.statusText}`);
    }
  }
}

/** デフォルトインスタンス */
export const testApiClient = new TestApiClient();
