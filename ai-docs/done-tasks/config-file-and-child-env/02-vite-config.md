# 02. Vite への VITE_ 変数の受け渡し

作成日: 2026-10-17
ステータス: 完了

## 現状

- `vite.config.ts` が `.env.example` を dotenv で読み、Vite 標準の `loadEnv`（`.env` / `.env.local` / `.env.[mode]` …）とマージして `base` を決める
- `import.meta.env.VITE_*` は Vite 標準の `.env` 読み込みと、`process.env` の `VITE_` 変数（`loadAppConfig` が書き込んだもの）から埋め込まれる
- 開発サーバーは `ExpressViteDev` が `Vite.createServer({ root })` で同一プロセス内に起動し、`vite.config.ts` を読む
- 公開物（WASM 版）は `vite build` 単独で作る（サーバーを経由しない）

## 方針

`vite.config.ts` が 01 の `loadConfigValues(fsConfigFileReader, process.env)` を直接呼び、`VITE_` で始まるキーを `define` で埋め込む。

```ts
import { defineConfig } from 'vite';
import { loadConfigValues, fsConfigFileReader } from './src/app/ConfigLoader';

export default defineConfig(() => {
  const values = loadConfigValues(fsConfigFileReader, process.env);
  const define = Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => key.startsWith('VITE_'))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
  );
  return {
    base: values.VITE_BASE_PATH || '/',
    define,
    // ...（既存の plugins / build / server）
  };
});
```

- `process.env` を参照するのは「環境変数による上書き」のためだけで、書き込みはしない
- `env.example.js` が無い場合は `ConfigError` で失敗する（従来の vite.config.ts は無視していた）。既定値の定義元が必須である点をサーバーと揃える
- `vite.config.ts` は `src/app/ConfigLoader.ts` を相対 import する。Vite は設定ファイルのローカル import をバンドルするため動作する（`ConfigLoader` → `Config.ts` → `interfaces/EnvConfig.ts` は Node 組み込み以外に依存しない）

### Vite 標準の .env 読み込み

手元に古い `.env.local` が残っていると Vite がそれを読む。`envDir: false`（インストール済みの Vite 6.4.3 で `string | false` として型定義あり）を指定して `.env` の読み込みを無効にする。

### 開発サーバーでの設定ファイルの配信防止

`ExpressViteDev` は `root: cwd` で Vite を起動する。Vite の既定の `server.fs.deny` は `['.env', '.env.*', '*.{crt,pem}', '**/.git/**']` で、`.env.local` は配信されなかったが、`env.local.js` / `env.example.js` は配信されてしまう（ローカルのパス等を含み得る）。

`vite.config.ts` で `server.fs.deny` を指定する。指定すると既定値が置き換わるため、既定の項目も並べる:

```ts
server: {
  port: 5173,
  fs: {
    // 指定すると Vite の既定値を置き換えるため、既定の項目も残す
    deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', 'env.local.*', 'env.example.*'],
  },
},
```

確認: `npm run dev` で `/env.local.js` と `/env.example.js` が 403 になること。

## 確認方法

- `npm run build` 後、`dist/` の JS に `env.example.js` の `VITE_APPLICATION_FLAVOR` の値が文字列として埋め込まれていること（`grep`）
- `VITE_APPLICATION_FLAVOR=wasm npm run build-vite` で環境変数の上書きが効くこと
- `npm run dev` でページを開き、フレーバー（websocket）とバージョン表示が反映されていること。`define` の `import.meta.env.*` は開発サーバーでも置換される（Vite 5 以降）が、実際に確認する
