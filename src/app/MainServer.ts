import { setupExpressServer } from './Web/Express';
import { loadAppConfig } from './ConfigLoader';

// 安全網: 想定外の例外・未処理の reject でサーバ全体（他の利用者の実行）が停止しないよう、
// ログに残して動作を続ける。起動処理中の例外も保護するため、最初に登録する。
// ここに到達するのは、通常のハンドラの try/catch で捕捉できなかった例外のみ。
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

(async () => {
  try {
    // 設定は import 時ではなくここで読み込む（.env.example が無い・値が不正なら起動を失敗させる）
    const config = loadAppConfig();
    console.log('Config.frontend', config.frontend);
    const server = await setupExpressServer(config);

    // 実行中の子プロセスを残さないよう、終了シグナルで後始末してから終了する
    // （SIGTERM は docker stop / systemd が送る）
    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Shutting down (${signal})...`);
      // 接続が閉じない等で終了処理が長引いても、必ず終了する
      setTimeout(() => process.exit(1), 10_000).unref();
      try {
        await server.shutdown();
      } catch (e) {
        console.error('Error during shutdown:', e);
      } finally {
        process.exit(0);
      }
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
