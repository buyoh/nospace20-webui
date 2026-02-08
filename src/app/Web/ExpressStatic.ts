import Express from 'express';

export async function bindStaticFileToExpress(
  express: Express.Express
): Promise<void> {
  express.use(Express.static('dist'));
}
