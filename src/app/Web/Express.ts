import Http from 'http';
import Https from 'https';
import Express from 'express';
import { bindViteDevToExpress } from './ExpressViteDev';
import { bindSocketIOToExpress } from './ExpressSocketIO';
import { bindStaticFileToExpress } from './ExpressStatic';
import { CounterService } from '../Services/CounterService';

export async function setupExpressServer(
  counterService: CounterService,
  port = 3030,
  sslConfig: null | object,
  frontEndType: 'vite' | 'static'
): Promise<void> {
  const appExpress = Express();

  if (frontEndType === 'vite') {
    await bindViteDevToExpress(appExpress);
  } else {
    await bindStaticFileToExpress(appExpress);
  }

  const httpServer = sslConfig
    ? Https.createServer(sslConfig, appExpress)
    : Http.createServer(appExpress);
  await bindSocketIOToExpress(counterService, httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on localhost:${port} - env='${process.env.NODE_ENV}'`);
  });
}
