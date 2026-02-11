// for Server Configurations only

const production = process.env.NODE_ENV === 'production';
const develop = !production;

const httpPort = parseInt(process.env.PORT || '8080');

const frontend: 'vite' | 'static' =
  process.env.FRONTEND === 'static' ? 'static' : 'vite';

// nospace20 related configurations
const nospaceBinPath =
  process.env.NOSPACE_BIN_PATH ?? './components/nospace20/bin/nospace20';
const nospaceTimeout = parseInt(process.env.NOSPACE_TIMEOUT ?? '30') * 1000; // in ms
const nospaceMaxProcesses = parseInt(
  process.env.NOSPACE_MAX_PROCESSES ?? '5'
);

export default {
  production,
  develop,
  httpPort,
  frontend,
  nospaceBinPath,
  nospaceTimeout,
  nospaceMaxProcesses,
};
