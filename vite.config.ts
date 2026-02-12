import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
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
});
