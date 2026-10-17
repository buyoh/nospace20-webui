# 設定ファイルの JS 化と子プロセス環境変数の絞り込み

設定ファイルを `.env.example` / `.env.local`（dotenv）から `env.example.js` / `env.local.js` に移し、読み込んだ設定値を `process.env` に書き込まないようにする。あわせて nospace20 子プロセスに渡す環境変数を許可リストに絞る。

作成日: 2026-10-17
ステータス: 完了

## 背景・動機

[code-review-2026-10-16/10](../../done-tasks/code-review-2026-10-16/10-config-and-env.md) の (c)「子プロセスへの全環境変数継承（low）」（[review-2026-10-16-followup](../../tasks/review-2026-10-16-followup.md) 7 で見送り）。

- `NospaceExecutionService` の `spawn` は `env` を指定しておらず、サーバーの `process.env` がすべて子プロセスに渡る
- `loadAppConfig` が `.env.example` / `.env.local` の値を `process.env` に書き込んでいる（Vite に `VITE_` 変数を見せるため）。そのため設定ファイルの値もすべて子プロセスに渡る
- nospace から環境変数を読めるかは未確認なので、多層防御として扱う

設定を環境変数の形で持つ限り、`process.env` に入れて他の部分（Vite）に渡すことになりやすい。そこで設定ファイルを環境変数とは別の形式にし、値は読み込み側のオブジェクトの中だけで扱う。

## 設計・方針

| ドキュメント | 内容 |
|---|---|
| [01-config-file-format.md](01-config-file-format.md) | 設定ファイルの形式の選定（JS を採用）、ファイル構成、読み込み（ConfigLoader）の変更 |
| [02-vite-config.md](02-vite-config.md) | Vite（`vite build` / 開発サーバー）への `VITE_` 変数の渡し方 |
| [03-child-process-env.md](03-child-process-env.md) | 子プロセスに渡す環境変数の許可リスト |

要点:

1. 設定ファイルは `env.example.js`（必須・コミット）と `env.local.js`（任意・gitignore）。CommonJS で、環境変数と同じキー名のフラットなオブジェクトを `module.exports` する
2. 優先順位は 環境変数 > `env.local.js` > `env.example.js`（現状と同じ）。ただし結果は `process.env` に書き込まない
3. Vite には `vite.config.ts` が同じローダーで値を読み、`define` で `import.meta.env.VITE_*` を埋め込む。開発サーバーが `env.*.js` を配信しないよう `server.fs.deny` に追加する
4. 子プロセスには許可リスト（`LANG` など）の環境変数だけを渡す。実際の環境変数（シェル由来）も絞り込まれる
5. `dotenv` 依存を削除する

### 対象外

- 設定値の意味・検証（`parseAppConfig`）の変更。キー名も変えない
- Web 側の `src/web/libs/env.ts`（`import.meta.env` を読む部分）は変更しない

## 設計レビュー

1 回実施。指摘（開発サーバーが `env.*.js` を配信する、`NODE_ENV` が `process.env` に入らなくなる、`CONFIG_KEYS` の配置、許可リストの `PATH`、テストの絞り込み等）はすべて設計に反映済み。

## 実装結果（2026-10-17）

- 設計どおり実装。設計からの差分: `createProcessSpawner` は `NospaceExecutionService.ts` ではなく `ChildProcessEnv.ts` に置いた（テスト名と対象モジュールを揃えるため）。`ConfigKey` 型は export しない
- テスト: `ConfigLoader.spec`（書き換え 9 ケース）、`ChildProcessEnv.spec`（1 ケース）。jest 全 718 件成功、`tsc`・`eslint`・`npm run build` 成功
- 動作確認:
  - `npm run build` の出力に `VITE_WEBUI_VERSION` が埋め込まれる。`VITE_WEBUI_VERSION=9999.11.22` の環境変数による上書きも反映される
  - 開発サーバー（`MainServer`）で `/env.local.js`・`/env.example.js` が 403。`import.meta.env.VITE_APPLICATION_FLAVOR` は `"websocket"` に置換される
- 開発者の `.env.example` / `.env.local` は `.trash/env-migration-20261017/` に移動し、`.env.local` の差分（`NOSPACE_BIN_PATH`, `NOSPACE_TEST_DIR`）を `env.local.js` に移した
- 補足（コードレビュー指摘）: `envDir: false` でも Vite は `process.env` の `VITE_*` を `import.meta.env` に取り込む。定義済みのキーは `define` が優先されるため実害なし（コメントに明記）

## コードレビュー

1 回実施。critical / major なし。minor（ドキュメントの未更新、`createProcessSpawner` の配置、`envDir` のコメント、`ConfigKey` の export）は対応済み。

## タスクステップ・チェックリスト

1. [x] 設定ファイル（[01](01-config-file-format.md)）
   1. [x] `env.example.js` を作成し、`.env.example` を `.trash/` に移動
   2. [x] 開発者の `.env.local` を `env.local.js` に変換し、`.env.local` を `.trash/` に移動（gitignore 対象のローカルファイル）
   3. [x] `.gitignore` に `/env.local.*` を追加
   4. [x] `ConfigLoader` の書き換え（JS 読み込み・未知キーの検出・`process.env` へ書き込まない）
   5. [x] `ExpectedEnvVars` に `VITE_BASE_PATH` を追加し、キー一覧 `CONFIG_KEYS` を ConfigLoader に持つ
2. [x] Vite（[02](02-vite-config.md)）
   1. [x] `vite.config.ts` を `loadConfigValues` + `define` に書き換え
   2. [x] `envDir: false` と `server.fs.deny` の指定
   3. [x] `npm run build` の出力に `VITE_` の値が埋め込まれることを確認
   4. [x] 開発サーバー（`npm run dev`）でフレーバー等が反映され、`/env.local.js` が 403 になることを確認
3. [x] 子プロセス（[03](03-child-process-env.md)）
   1. [x] `buildChildProcessEnv` / `createProcessSpawner` を追加
   2. [x] `NospaceExecutionService` の既定の spawner を差し替え
4. [x] テスト: `ConfigLoader.spec` 書き換え、`ChildProcessEnv.spec` 追加
5. [x] `dotenv` の削除、README「設定（サーバー）」の更新、コメント内の `.env.example` 表記の更新
