import { Express } from 'express';
import { TestFileService } from '../Services/TestFileService';
import { TestController } from '../Controllers/TestController';

/**
 * テスト管理APIのルートをExpressアプリにバインドする
 */
export function bindTestRoutes(app: Express, testDir: string): void {
  const service = new TestFileService(testDir);
  const controller = new TestController(service);

  // Enable JSON body parsing for these routes
  app.use('/api/tests', (req, res, next) => {
    if (!req.headers['content-type']?.includes('application/json')) {
      if (req.method === 'POST' || req.method === 'PUT') {
        res.status(400).json({ error: 'Content-Type must be application/json' });
        return;
      }
    }
    next();
  });

  // GET /api/tests - テストツリー取得
  app.get('/api/tests', (req, res) => controller.handleGetTree(req, res));

  // GET /api/tests/* - テストケース取得
  app.get('/api/tests/*', (req, res) => controller.handleGetTestCase(req, res));

  // PUT /api/tests/* - テストケース更新
  app.put('/api/tests/*', (req, res) =>
    controller.handleUpdateTestCase(req, res)
  );

  // POST /api/tests - テストケース作成
  app.post('/api/tests', (req, res) =>
    controller.handleCreateTestCase(req, res)
  );
}
