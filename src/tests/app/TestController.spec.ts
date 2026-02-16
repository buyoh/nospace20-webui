import { Request, Response } from 'express';
import { TestController } from '../../app/Controllers/TestController';
import type {
  TestTreeNode,
  TestCaseResponse,
  TestCaseUpdateRequest,
  TestCaseCreateRequest,
} from '../../interfaces/TestTypes';

/** Fake TestFileService */
class FakeTestFileService {
  getTreeResult: TestTreeNode[] = [];
  getTestCaseResult: TestCaseResponse | null = null;
  lastUpdatePath: string | null = null;
  lastUpdateData: TestCaseUpdateRequest | null = null;
  lastCreateData: TestCaseCreateRequest | null = null;
  shouldThrow: Error | null = null;

  async getTree(): Promise<TestTreeNode[]> {
    if (this.shouldThrow) throw this.shouldThrow;
    return this.getTreeResult;
  }

  async getTestCase(path: string): Promise<TestCaseResponse> {
    if (this.shouldThrow) throw this.shouldThrow;
    if (this.getTestCaseResult === null) {
      throw new Error('getTestCaseResult not set');
    }
    return this.getTestCaseResult;
  }

  async updateTestCase(
    path: string,
    data: TestCaseUpdateRequest
  ): Promise<void> {
    if (this.shouldThrow) throw this.shouldThrow;
    this.lastUpdatePath = path;
    this.lastUpdateData = data;
  }

  async createTestCase(data: TestCaseCreateRequest): Promise<void> {
    if (this.shouldThrow) throw this.shouldThrow;
    this.lastCreateData = data;
  }
}

/** Create fake Express Request */
function createFakeRequest(params: Record<string, any>, body?: any): Request {
  return {
    params,
    body: body || {},
  } as Request;
}

/** Create fake Express Response */
function createFakeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    statusCode: 200,
  };
  return res as unknown as Response;
}

describe('TestController', () => {
  describe('handleGetTree', () => {
    it('should return tree response', async () => {
      const service = new FakeTestFileService();
      service.getTreeResult = [
        {
          name: 'passes',
          path: 'passes',
          type: 'directory',
          children: [],
        },
      ];

      const controller = new TestController(service as any);
      const req = createFakeRequest({});
      const res = createFakeResponse();

      await controller.handleGetTree(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        tree: service.getTreeResult,
      });
    });

    it('should return 500 on error', async () => {
      const service = new FakeTestFileService();
      service.shouldThrow = new Error('Test error');

      const controller = new TestController(service as any);
      const req = createFakeRequest({});
      const res = createFakeResponse();

      await controller.handleGetTree(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('handleGetTestCase', () => {
    it('should return test case', async () => {
      const service = new FakeTestFileService();
      service.getTestCaseResult = {
        path: 'passes/test1',
        source: 'source code',
        check: '{}',
      };

      const controller = new TestController(service as any);
      const req = createFakeRequest({ 0: 'passes/test1' });
      const res = createFakeResponse();

      await controller.handleGetTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(service.getTestCaseResult);
    });

    it('should return 400 when path is missing', async () => {
      const service = new FakeTestFileService();
      const controller = new TestController(service as any);
      const req = createFakeRequest({});
      const res = createFakeResponse();

      await controller.handleGetTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Path is required' });
    });

    it('should return 404 when test file not found', async () => {
      const service = new FakeTestFileService();
      service.shouldThrow = new Error('Test file not found: passes/test1');

      const controller = new TestController(service as any);
      const req = createFakeRequest({ 0: 'passes/test1' });
      const res = createFakeResponse();

      await controller.handleGetTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Test file not found: passes/test1',
      });
    });

    it('should return 400 on path traversal', async () => {
      const service = new FakeTestFileService();
      service.shouldThrow = new Error('Path traversal is not allowed');

      const controller = new TestController(service as any);
      const req = createFakeRequest({ 0: '../../../etc/passwd' });
      const res = createFakeResponse();

      await controller.handleGetTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid path' });
    });
  });

  describe('handleUpdateTestCase', () => {
    it('should update test case', async () => {
      const service = new FakeTestFileService();
      const controller = new TestController(service as any);
      const req = createFakeRequest(
        { 0: 'passes/test1' },
        { source: 'new source', check: 'new check' }
      );
      const res = createFakeResponse();

      await controller.handleUpdateTestCase(req, res);

      expect(service.lastUpdatePath).toBe('passes/test1');
      expect(service.lastUpdateData).toEqual({
        source: 'new source',
        check: 'new check',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 when path is missing', async () => {
      const service = new FakeTestFileService();
      const controller = new TestController(service as any);
      const req = createFakeRequest({}, { source: 'source' });
      const res = createFakeResponse();

      await controller.handleUpdateTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Path is required' });
    });

    it('should return 400 when source is missing', async () => {
      const service = new FakeTestFileService();
      const controller = new TestController(service as any);
      const req = createFakeRequest({ 0: 'passes/test1' }, {});
      const res = createFakeResponse();

      await controller.handleUpdateTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Source is required' });
    });

    it('should return 404 when test file not found', async () => {
      const service = new FakeTestFileService();
      service.shouldThrow = new Error('Test file not found: passes/test1');

      const controller = new TestController(service as any);
      const req = createFakeRequest(
        { 0: 'passes/test1' },
        { source: 'source' }
      );
      const res = createFakeResponse();

      await controller.handleUpdateTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('handleCreateTestCase', () => {
    it('should create test case', async () => {
      const service = new FakeTestFileService();
      const controller = new TestController(service as any);
      const req = createFakeRequest(
        {},
        {
          path: 'passes/test1',
          source: 'source code',
          check: '{}',
        }
      );
      const res = createFakeResponse();

      await controller.handleCreateTestCase(req, res);

      expect(service.lastCreateData).toEqual({
        path: 'passes/test1',
        source: 'source code',
        check: '{}',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 400 when path or source is missing', async () => {
      const service = new FakeTestFileService();
      const controller = new TestController(service as any);
      const req = createFakeRequest({}, { path: 'passes/test1' });
      const res = createFakeResponse();

      await controller.handleCreateTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Path and source are required',
      });
    });

    it('should return 409 when test file already exists', async () => {
      const service = new FakeTestFileService();
      service.shouldThrow = new Error('Test file already exists: passes/test1');

      const controller = new TestController(service as any);
      const req = createFakeRequest(
        {},
        {
          path: 'passes/test1',
          source: 'source',
        }
      );
      const res = createFakeResponse();

      await controller.handleCreateTestCase(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Test file already exists: passes/test1',
      });
    });
  });
});
