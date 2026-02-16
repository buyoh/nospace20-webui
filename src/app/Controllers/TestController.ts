import { Request, Response } from 'express';
import { TestFileService } from '../Services/TestFileService';
import type {
  TestTreeResponse,
  TestCaseResponse,
  TestCaseUpdateRequest,
  TestCaseUpdateResponse,
  TestCaseCreateRequest,
  TestCaseCreateResponse,
} from '../../interfaces/TestTypes';

/**
 * テスト管理APIのコントローラー
 */
export class TestController {
  constructor(private readonly service: TestFileService) {}

  /**
   * GET /api/tests
   * テストツリーを返す
   */
  async handleGetTree(req: Request, res: Response): Promise<void> {
    try {
      const tree = await this.service.getTree();
      const response: TestTreeResponse = { tree };
      res.status(200).json(response);
    } catch (error) {
      console.error('Error in handleGetTree:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * GET /api/tests/:path(*)
   * テストケースの詳細を返す
   */
  async handleGetTestCase(req: Request, res: Response): Promise<void> {
    try {
      const path = req.params[0]; // Express wildcard capture
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const testCase = await this.service.getTestCase(path);
      res.status(200).json(testCase);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else if (
        error.message?.includes('traversal') ||
        error.message?.includes('Absolute paths')
      ) {
        res.status(400).json({ error: 'Invalid path' });
      } else {
        console.error('Error in handleGetTestCase:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * PUT /api/tests/:path(*)
   * テストケースを更新する
   */
  async handleUpdateTestCase(req: Request, res: Response): Promise<void> {
    try {
      const path = req.params[0]; // Express wildcard capture
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const data: TestCaseUpdateRequest = req.body;
      if (!data.source) {
        res.status(400).json({ error: 'Source is required' });
        return;
      }

      await this.service.updateTestCase(path, data);
      const response: TestCaseUpdateResponse = { success: true };
      res.status(200).json(response);
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else if (
        error.message?.includes('traversal') ||
        error.message?.includes('Absolute paths')
      ) {
        res.status(400).json({ error: 'Invalid path' });
      } else {
        console.error('Error in handleUpdateTestCase:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * POST /api/tests
   * 新しいテストケースを作成する
   */
  async handleCreateTestCase(req: Request, res: Response): Promise<void> {
    try {
      const data: TestCaseCreateRequest = req.body;
      if (!data.path || !data.source) {
        res.status(400).json({ error: 'Path and source are required' });
        return;
      }

      await this.service.createTestCase(data);
      const response: TestCaseCreateResponse = { success: true };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else if (
        error.message?.includes('traversal') ||
        error.message?.includes('Absolute paths')
      ) {
        res.status(400).json({ error: 'Invalid path' });
      } else {
        console.error('Error in handleCreateTestCase:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
