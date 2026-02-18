import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { parse } from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  // .env.example を最低優先度で読み込む（process.envに注入しない）
  let exampleEnv: Record<string, string> = {};
  try {
    const examplePath = path.resolve(process.cwd(), '.env.example');
    exampleEnv = parse(readFileSync(examplePath));
  } catch (e) {
    // .env.example が存在しない場合は無視
  }
  
  // Vite標準の環境変数読み込み（.env, .env.local, .env.[mode], .env.[mode].local）
  const env = loadEnv(mode, process.cwd(), '');
  
  // 優先順位: env（高） > exampleEnv（低）
  const mergedEnv = { ...exampleEnv, ...env };
  
  return {
    base: mergedEnv.VITE_BASE_PATH || '/',
    server: {
      port: 5173,
    },
    plugins: [
      react(),
      wasm(),
    ],
    build: {
      // vite-plugin-wasm が生成する top-level await に必要
      target: 'esnext',
    },
  };
});
