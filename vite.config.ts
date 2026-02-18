import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: env.VITE_BASE_PATH || '/',
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
