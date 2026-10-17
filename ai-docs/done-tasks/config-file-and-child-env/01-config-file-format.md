# 01. 設定ファイルの形式と読み込み

作成日: 2026-10-17
ステータス: 完了

## 形式の選定

| 形式 | コメント | 追加パッケージ | 判断 |
|---|---|---|---|
| JSON | 書けない | 不要 | 却下（指示どおり） |
| JavaScript | 書ける | 不要 | **採用** |
| YAML | 書ける | `yaml` が必要 | 不採用 |

現状の設定は「キー = スカラー値」のフラットな 11 項目で、ネストも計算も無い。JS で書いても `.env` とほぼ同じ見た目に収まり、複雑にならないため YAML（依存追加）は不要と判断する。

### JS 採用に伴う注意

- 設定ファイルはコードとして実行される。ローカルの開発者が置くファイルで、外部入力ではないため許容する
- `package.json` に `"type"` が無いので `.js` は CommonJS。`module.exports = { ... }` で書く
- `require` のキャッシュにより、同一プロセスで 2 回読んでも同じ値になる（開発サーバーでは ConfigLoader と vite.config.ts が同じオブジェクトを得る）。設定ファイルを編集した場合は**サーバーの再起動が必要**（Vite の設定依存にも含まれない）
- `NODE_ENV` は `process.env` に反映されなくなる。Express（`app.get('env')`）やライブラリは実際の環境変数しか見ないため、本番動作は従来どおり環境変数で指定する（`npm run prod` が `NODE_ENV=production` を設定する）。設定ファイルの `NODE_ENV` は `AppConfig.production` の判定にのみ使われる旨を `env.example.js` のコメントと README に書く

## ファイル構成

| ファイル | 役割 | git |
|---|---|---|
| `env.example.js` | 既定値の定義元。**必須**（無ければ起動失敗） | コミット |
| `env.local.js` | ローカルの上書き。任意 | `.gitignore` に `/env.local.*` |

`env.example.js` の例（`.env.example` のコメントと値をそのまま移す）:

```js
// サーバー・Vite の設定の既定値。ローカルで上書きする場合は env.local.js を作成する
// （同じ形式で、上書きしたいキーだけを書く）。実際の環境変数が最優先。
module.exports = {
  // =====================================
  // NODE
  NODE_ENV: 'development',

  // =====================================
  // Feature Flags

  // アプリケーションの実行フレーバー ('websocket' | 'wasm')
  VITE_APPLICATION_FLAVOR: 'websocket',
  // ...
  // プロセス実行タイムアウト（秒）
  NOSPACE_TIMEOUT: 30,
  // ...
};
```

- キー名は現在の環境変数名と同じ（`ExpectedEnvVars` のキー）。環境変数による上書き（`npm run prod` の `FRONTEND=static NODE_ENV=production` など）がそのまま使える
- 値は `string` または `number`。数値は `String()` で文字列にしてから既存の `parseAppConfig` に渡す（検証ロジックは変更しない）

## ConfigLoader の変更

```ts
/** 設定ファイルの読み込み（テスト時に差し替えるため抽象化する） */
export interface ConfigFileReader {
  /** ファイルの export を返す。ファイルが存在しない場合は { found: false } */
  read(fileName: string): { found: true; value: unknown } | { found: false };
}

/** 既定値・ローカル上書き・環境変数をマージした設定値を返す（process.env には書き込まない） */
export function loadConfigValues(reader, env = process.env): ExpectedEnvVars;

/** loadConfigValues + parseAppConfig */
export function loadAppConfig(reader = fsConfigFileReader, env = process.env): AppConfig;
```

### 処理

1. `env.example.js` を読む。存在しなければ `ConfigError`（現状と同じ）
2. `env.local.js` を読む（存在しなくてよい）
3. 各ファイルの内容を検証して `Record<string, string>` に正規化する
   - プレーンなオブジェクトでなければ `ConfigError`
   - **未知のキー**（`CONFIG_KEYS` に無い）は `ConfigError`（綴り間違いで黙って既定値が使われるのを防ぐ）
   - 値が `string` / `number` 以外なら `ConfigError`
4. マージ: `{ ...example, ...local }` に対し、`CONFIG_KEYS` のうち `env[key] !== undefined` のものを環境変数の値で上書きする
5. **`env` には書き込まない**（従来の `env[key] = value` を削除）

### キー一覧

実行時の定数を `src/app/ConfigLoader.ts` に置く（Web 側では不要なため、型定義のみの `src/interfaces/` には置かない）。型と一覧を一致させる:

```ts
export const CONFIG_KEYS = [
  'NODE_ENV', 'VITE_APPLICATION_FLAVOR', 'VITE_BASE_PATH', 'PORT', 'FRONTEND',
  'NOSPACE_BIN_PATH', 'NOSPACE_TIMEOUT', 'NOSPACE_MAX_PROCESSES', 'NOSPACE_TEST_DIR',
  'VITE_NOSPACE_VERSION', 'VITE_WEBUI_VERSION',
] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];
```

`src/interfaces/EnvConfig.ts` の `ExpectedEnvVars` は既存の interface（ドキュメントコメント付き）を残し、`VITE_BASE_PATH` を追加する。`CONFIG_KEYS` と `keyof ExpectedEnvVars` の一致は型レベルで検査する:

```ts
] as const satisfies readonly (keyof ExpectedEnvVars)[];
// ExpectedEnvVars にキーを追加して CONFIG_KEYS に追加し忘れた場合に型エラーにする
const _allKeysListed: [Exclude<keyof ExpectedEnvVars, ConfigKey>] extends [never] ? true : false = true;
```

### 実ファイルの読み込み（fsConfigFileReader）

```ts
export const fsConfigFileReader: ConfigFileReader = {
  read(fileName) {
    const absPath = path.resolve(process.cwd(), fileName);
    if (!existsSync(absPath)) return { found: false };
    // vite.config.ts（ESM としてバンドルされる場合がある）からも使うため、
    // グローバルの require ではなく createRequire を使う
    return { found: true, value: createRequire(absPath)(absPath) };
  },
};
```

- 読み込み時の例外（構文エラーなど）はそのまま投げる（起動失敗）
- `module.exports` が `default` を持つ ESM 形式は対象外（CommonJS のみ）

## 影響を受けるもの

| 対象 | 変更 |
|---|---|
| `src/app/ConfigLoader.ts` | 上記。`dotenv` の import を削除。ドキュメントコメント（優先順位・env への反映）を更新 |
| `src/app/Config.ts` | エラーメッセージの `.env.example or .env.local` → `env.example.js or env.local.js` |
| `src/interfaces/EnvConfig.ts` | `VITE_BASE_PATH` 追加、コメント（`修正後、.env.example も更新すること` 等）の更新 |
| `.gitignore` | `/env.local.*` を追加。`.env` / `.env.local` 等は残す（移行後に残ったファイルを誤ってコミットしないため） |
| CI (`.github/workflows/test.yml`) | 変更なし。`npm run build` がコミット済みの `env.example.js` を必要とすることを確認する |
| `src/app/MainServer.ts` | 冒頭コメント `.env.example も更新すること` の更新 |
| `src/tests/app/ConfigLoader.spec.ts` | インメモリ reader をオブジェクト版に書き換え。`env` に書き込まないことを検証するケースを追加（旧「未定義の環境変数のみ env に反映する」の置き換え）、未知キー・不正な値型のケースを追加 |
| `src/tests/app/Config.spec.ts` | 説明文の `.env.example` 表記のみ（ロジック変更なし） |
| `package.json` | `dotenv` を削除（`vite.config.ts` も使わなくなるため） |
| `README.md` | 「設定（サーバー）」を新しいファイル名で書き換え。既存の `.env.local` は使われなくなるので `env.local.js` に移すよう注記 |
