import { setupExpressServer } from './Web/Express';
import Config from './Config';

(async () => {
  try {
    console.log('Config.frontend', Config.frontend);
    await setupExpressServer(
      Config.httpPort,
      null, // SSLは必要に応じて設定
      Config.frontend,
      Config.nospaceTestDir
    );

    // trap
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      process.exit(0);
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
