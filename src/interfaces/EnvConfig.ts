/**
 * アプリケーションが使用する環境変数の定義。
 * 値は env.example.js（既定値）・env.local.js・実際の環境変数から読み込まれる（src/app/ConfigLoader.ts）。
 * Web 側は src/web/libs/env.ts（vite.config.ts の define 経由）、App 側は src/app/Config.ts で読み込む。
 * キーを追加した場合は env.example.js と ConfigLoader の CONFIG_KEYS も更新すること。
 */
export interface ExpectedEnvVars {
  /** (web, app)実行環境 ('production' | 'development' 等) */
  NODE_ENV?: string;
  /** (web) アプリケーション実行フレーバー ('websocket' | 'wasm') */
  VITE_APPLICATION_FLAVOR?: string;
  /** (web) ベースパス */
  VITE_BASE_PATH?: string;
  /** (app)HTTP サーバーポート */
  PORT?: string;
  /** (app)フロントエンド配信モード ('vite' | 'static') */
  FRONTEND?: string;
  /** (app)nospace20 実行ファイルのパス */
  NOSPACE_BIN_PATH?: string;
  /** (app)whitespace20 実行ファイルのパス */
  NOSPACE_WHITESPACE_BIN_PATH?: string;
  /** (app)プロセス実行タイムアウト（秒） */
  NOSPACE_TIMEOUT?: string;
  /** (app)同時実行プロセス数の上限 */
  NOSPACE_MAX_PROCESSES?: string;
  /** (app)テストファイルディレクトリのパス */
  NOSPACE_TEST_DIR?: string;
  /** (web) nospace コンパイラのバージョン (semver) */
  VITE_NOSPACE_VERSION?: string;
  /** (web) nospace-webui のバージョン (日付: YYYY.MM.DD) */
  VITE_WEBUI_VERSION?: string;
}
