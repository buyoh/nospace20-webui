// for Server Configurations only

const production = process.env.NODE_ENV === 'production';
const develop = !production;

const httpPort = parseInt(process.env.PORT || '8080');

const frontend: 'vite' | 'static' =
  process.env.FRONTEND === 'static' ? 'static' : 'vite';

export default {
  production,
  develop,
  httpPort,
  frontend,
};
