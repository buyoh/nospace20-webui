import Http from 'http';
import Https from 'https';
import Express from 'express';
import { bindViteDevToExpress } from './ExpressViteDev';
import { bindSocketIOToExpress } from './ExpressSocketIO';
import { bindStaticFileToExpress } from './ExpressStatic';
import { bindTestRoutes } from '../Routes/TestRoutes';
import { NospaceExecutionService } from '../Services/NospaceExecutionService';
import type { AppConfig } from '../Config';

/** 起動済みのサーバ */
export interface RunningServer {
  /** 実行中のプロセスを終了させ、接続と HTTP サーバを閉じる */
  shutdown(): Promise<void>;
}

/**
 * Express サーバを組み立てて起動する。設定は呼び出し側（エントリポイント）から受け取る。
 * ポートが使用中などで listen に失敗した場合は reject する。
 */
export async function setupExpressServer(
  config: AppConfig,
  sslConfig: null | object = null
): Promise<RunningServer> {
  const appExpress = Express();

  // Enable JSON body parsing
  appExpress.use(Express.json());

  // テスト管理 API。ディレクトリが空文字の場合は無効
  if (config.nospaceTestDir) {
    bindTestRoutes(appExpress, config.nospaceTestDir);
  }

  if (config.frontend === 'vite') {
    // Vite の開発サーバは開発専用。本番設定で公開状態のまま起動してしまうのを防ぐ
    if (!config.develop) {
      throw new Error(
        "FRONTEND=vite is only available in development (NODE_ENV must not be 'production')"
      );
    }
    await bindViteDevToExpress(appExpress);
  } else {
    await bindStaticFileToExpress(appExpress);
  }

  const httpServer = sslConfig
    ? Https.createServer(sslConfig, appExpress)
    : Http.createServer(appExpress);
  const executionService = new NospaceExecutionService(config);
  const io = await bindSocketIOToExpress(httpServer, executionService);

  // BUG FIX: listen の 'error'（EADDRINUSE など）が未処理で、起動失敗の原因が分かりにくかった。
  // 解決策として listen の失敗を reject に変換し、エントリポイントで報告して終了する。
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.httpPort, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });
  console.log(
    `> Ready on localhost:${config.httpPort} - env='${config.production ? 'production' : 'development'}'`
  );

  return {
    async shutdown() {
      await executionService.killAll();
      // io.close() は接続されているクライアントを切断し、HTTP サーバも閉じる
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
