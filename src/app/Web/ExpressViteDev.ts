import Express from 'express';
import Fs from 'fs';
import Path from 'path';

/**
 * Vite の開発サーバをミドルウェアとして結び付ける。開発専用。
 * 本番での起動を防ぐ判定は、設定を持つ呼び出し側（setupExpressServer）が行う。
 */
export async function bindViteDevToExpress(
  express: Express.Express
): Promise<void> {
  // Dynamic import because it is not used in production
  const Vite = await import('vite');

  // TODO: Refactoring
  const cwd = process.cwd();
  const viteServer = await Vite.createServer({
    root: cwd,
    logLevel: 'info',
    server: {
      middlewareMode: true,
      watch: {
        // usePolling: true,
        // interval: 500,
        useFsEvents: true,
      },
    },
  });
  express.use(viteServer.middlewares);

  express.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;

      const html = await Fs.promises.readFile(
        Path.resolve(cwd, 'index.html'),
        'utf-8'
      );

      res
        .status(200)
        .set({ 'Content-Type': 'text/html' })
        .end(await viteServer.transformIndexHtml(url, html));
    } catch (e) {
      if (e instanceof Error) {
        if (viteServer) {
          viteServer.ssrFixStacktrace(e);
        }
        console.warn(e.stack);
        res.status(500).end(e.stack);
      }
    }
  });
}
