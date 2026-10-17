import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import {
  fsConfigFileReader,
  loadConfigValues,
} from './src/app/ConfigLoader';

export default defineConfig(() => {
  // env.example.js（必須）・env.local.js・環境変数をマージした設定値（process.env には書き込まない）
  const values = loadConfigValues(fsConfigFileReader, process.env);

  // VITE_ で始まる値を import.meta.env.VITE_* として埋め込む
  const define = Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => key.startsWith('VITE_'))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  );

  return {
    base: values.VITE_BASE_PATH || '/',
    define,
    // 設定は env.*.js から読むため、Vite 標準の .env* ファイルの読み込みは無効にする
    // （移行前の .env.local が残っていても読まれないようにする）。
    // process.env の VITE_* は Vite が引き続き取り込むが、定義済みのキーは define が優先される
    envDir: false as const,
    server: {
      port: 5173,
      fs: {
        // 開発サーバーが設定ファイルを配信しないようにする。
        // 指定すると Vite の既定値を置き換えるため、既定の項目も残す
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem}',
          '**/.git/**',
          'env.local.*',
          'env.example.*',
        ],
      },
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
