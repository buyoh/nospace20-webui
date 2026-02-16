/**
 * アプリケーションが使用する環境変数の定義。
 * すべてのフィールドは任意であり、デフォルト値はそれぞれの読み込み側で設定する。
 * Web 側は src/web/libs/env.ts、App 側は src/app/Config.ts で読み込む。
 */
export interface ExpectedEnvVars {
  /** (web, app)実行環境 ('production' | 'development' 等) */
  NODE_ENV?: string;
  /** (web, app)Server Flavor の有効化 ('true' | 'false') */
  VITE_ENABLE_SERVER?: string;
  /** (app)HTTP サーバーポート */
  PORT?: string;
  /** (app)フロントエンド配信モード ('vite' | 'static') */
  FRONTEND?: string;
  /** (app)nospace20 実行ファイルのパス */
  NOSPACE_BIN_PATH?: string;
  /** (app)プロセス実行タイムアウト（秒） */
  NOSPACE_TIMEOUT?: string;
  /** (app)同時実行プロセス数の上限 */
  NOSPACE_MAX_PROCESSES?: string;
}
// 修正後、.env.example も更新すること
