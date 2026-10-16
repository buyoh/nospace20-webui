# 10. 設定読み込み・検証の不備

- 重要度: **medium**
- 対象: `src/app/Config.ts`, `.env.example`, `src/app/Web/ExpressViteDev.ts`, `src/app/Web/Express.ts`, `src/app/Services/NospaceExecutionService.ts`

## 問題点

### (a) `.env.example` を実行時設定として読み込む

`Config.ts:7-10` が `.env.example`（`NODE_ENV=development`, `FRONTEND=vite`）を読む。`npm run prod` を経由せず `node build/app/MainServer.js` で起動すると dev モードになり、Vite dev サーバが公開状態で起動を試みる。
Vite エラー時は `res.end(e.stack)`（`ExpressViteDev.ts:50`）でスタックトレースを返す。サンプルファイルと実行時設定ソースの混同。

また Config は import 時に dotenv を実行する副作用があり、Config 経由で import するテスト（`NospaceExecutionService.spec`, `NospaceController.spec`）が実ファイルの `.env.local` を読む（AGENTS.md「テストで実ファイルにアクセスしない」に軽微に抵触）。

### (b) 設定値の未検証

`Config.ts:31,37-38`。`NOSPACE_TIMEOUT=abc` → NaN → `setTimeout(NaN)` がほぼ即時発火し全プロセスが直後に kill される。PORT の NaN も未検証。`listen` の `error`（EADDRINUSE 等）も未処理（`Express.ts:36`）。

### (c) 子プロセスへの全環境変数継承（low）

`NospaceExecutionService.ts:325` の `spawn` で `env` 未指定。`.env.local` 由来の値を含む全環境変数が子プロセスに渡る。nospace から環境変数を読めるかは未確認のため多層防御として扱う。

## 違反しているルール・原則

- 安全側の既定値（fail-safe default）
- 設定のバリデーション（fail fast）
- 最小権限の原則
- AGENTS.md: テストで実ファイルにアクセスしない
- import 時副作用の回避 / DI

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | 安全側の既定値（production / static）をコードに持たせ、`.env.example` は読まない | `Config.ts`, README / npm scripts の確認 |
| 2 | dotenv 読み込みをエントリポイント（`MainServer`）へ移し、サービスへは DI で設定を渡す（`defaultExecutionConfig = Config` と `ExpressViteDev` の直接 import を解消） | `Config.ts`, `MainServer.ts`, `NospaceExecutionService`, `ExpressViteDev`, テスト |
| 3 | `parseAppConfig` で範囲検証し、異常値なら起動時に失敗。`listen` の `error` を処理 | `Config.ts`, `Express.ts`, `Config.spec.ts` |
| 4 | `spawn(bin, args, { env: { PATH: ... } })` で最小限の環境変数に限定 | `NospaceExecutionService` |
| 5 | 本番でスタックトレースを返さない | `ExpressViteDev.ts`（1 適用後は dev 専用のため優先度低） |
