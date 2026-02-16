// for Server Configurations only

import dotenv from 'dotenv';
import type { ExpectedEnvVars } from '../interfaces/EnvConfig';

// Load environment variables
// .env.local is loaded first (higher priority)
dotenv.config({ path: '.env.local' });
// .env.example is loaded as fallback (default values)
dotenv.config({ path: '.env.example' });

/** process.env から環境変数を読み込む */
function readEnvVars(): ExpectedEnvVars {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    FRONTEND: process.env.FRONTEND,
    NOSPACE_BIN_PATH: process.env.NOSPACE_BIN_PATH,
    NOSPACE_TIMEOUT: process.env.NOSPACE_TIMEOUT,
    NOSPACE_MAX_PROCESSES: process.env.NOSPACE_MAX_PROCESSES,
  };
}

/** 環境変数をパースしてアプリケーション設定を生成する */
export function parseAppConfig(env: ExpectedEnvVars) {
  const production = env.NODE_ENV === 'production';
  return {
    production,
    develop: !production,
    httpPort: parseInt(env.PORT || '8080'),
    frontend: (env.FRONTEND === 'static' ? 'static' : 'vite') as
      | 'vite'
      | 'static',
    nospaceBinPath:
      env.NOSPACE_BIN_PATH ?? './components/nospace20/bin/nospace20',
    nospaceTimeout: parseInt(env.NOSPACE_TIMEOUT ?? '30') * 1000, // in ms
    nospaceMaxProcesses: parseInt(env.NOSPACE_MAX_PROCESSES ?? '5'),
  };
}

export default parseAppConfig(readEnvVars());
