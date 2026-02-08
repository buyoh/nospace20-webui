import { createCounterService } from './Services/CounterService';
import { setupExpressServer } from './Web/Express';
import Config from './Config';

(async () => {
  try {
    const counterService = createCounterService();

    console.log('Config.frontend', Config.frontend);
    await setupExpressServer(
      counterService,
      Config.httpPort,
      null, // SSLは必要に応じて設定
      Config.frontend
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
