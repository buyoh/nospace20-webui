// サーバー・Vite の設定の既定値（必須。起動時に必ず読み込まれる）。
// ローカルで上書きする場合は env.local.js を作成し、同じ形式で上書きしたいキーだけを書く。
// 優先順位: 実際の環境変数 > env.local.js > env.example.js
// 値は process.env には反映されない。編集後はサーバーの再起動が必要。
module.exports = {
  // =====================================
  // NODE

  // 'production' で本番設定として扱う（AppConfig.production の判定のみ）。
  // Express 等のライブラリは実際の環境変数 NODE_ENV しか見ないため、
  // 本番動作は環境変数で指定する（npm run prod を参照）
  NODE_ENV: 'development',

  // =====================================
  // Feature Flags

  // アプリケーションの実行フレーバー ('websocket' | 'wasm')
  VITE_APPLICATION_FLAVOR: 'websocket',

  // =====================================
  // Web

  VITE_BASE_PATH: '/',

  // =====================================
  // Server

  // サーバーポート
  PORT: 8090,

  // フロントエンド配信モード ('vite' | 'static')
  FRONTEND: 'vite',

  // nospace20 実行ファイルのパス
  NOSPACE_BIN_PATH: './components/nospace20/bin/nospace20',

  // whitespace20 実行ファイルのパス
  NOSPACE_WHITESPACE_BIN_PATH: './components/nospace20/bin/whitespace20',

  // プロセス実行タイムアウト（秒）
  NOSPACE_TIMEOUT: 30,

  // 同時実行プロセス数の上限
  NOSPACE_MAX_PROCESSES: 5,

  // テストファイルディレクトリのパス（空文字でテスト管理 API を無効にする）
  NOSPACE_TEST_DIR: './resources/tests',

  // =====================================
  // Version Information

  // nospace コンパイラのバージョン (semver)
  VITE_NOSPACE_VERSION: '1.0.0',

  // nospace-webui のバージョン (日付: YYYY.MM.DD)
  VITE_WEBUI_VERSION: '2026.03.08',
};
