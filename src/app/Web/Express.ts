import Http from 'http';
import Https from 'https';
import Express from 'express';
import { bindViteDevToExpress } from './ExpressViteDev';
import { bindSocketIOToExpress } from './ExpressSocketIO';
import { bindStaticFileToExpress } from './ExpressStatic';
import { bindTestRoutes } from '../Routes/TestRoutes';

export async function setupExpressServer(
  port = 3030,
  sslConfig: null | object,
  frontEndType: 'vite' | 'static',
  testDir?: string
): Promise<void> {
  const appExpress = Express();

  // Enable JSON body parsing
  appExpress.use(Express.json());

  // Bind test routes if testDir is provided
  if (testDir) {
    bindTestRoutes(appExpress, testDir);
  }

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
