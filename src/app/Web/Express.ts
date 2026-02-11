import Http from 'http';
import Https from 'https';
import Express from 'express';
import { bindViteDevToExpress } from './ExpressViteDev';
import { bindSocketIOToExpress } from './ExpressSocketIO';
import { bindStaticFileToExpress } from './ExpressStatic';

export async function setupExpressServer(
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
  await bindSocketIOToExpress(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Ready on localhost:${port} - env='${process.env.NODE_ENV}'`);
  });
}
