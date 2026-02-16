import type {
  TestTreeResponse,
  TestCaseResponse,
  TestCaseUpdateRequest,
  TestCaseCreateRequest,
} from '../../interfaces/TestTypes';

/**
 * テスト管理APIのクライアント
 */
export class TestApiClient {
  /**
   * テストツリーを取得
   */
  async fetchTree(): Promise<TestTreeResponse> {
    const response = await fetch('/api/tests', {
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
  async fetchTestCase(path: string): Promise<TestCaseResponse> {
    const response = await fetch(`/api/tests/${path}`, {
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
    const response = await fetch(`/api/tests/${path}`, {
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
    const response = await fetch('/api/tests', {
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
