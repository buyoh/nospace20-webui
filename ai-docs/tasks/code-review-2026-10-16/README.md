# コードレビュー 2026-10-16

ソースコード・テストコード・設定ファイル全体を対象としたレビュー結果。
観点: 一般的な設計原則 / 安全性・エラー処理・フェイルセーフ / 外部公開アプリとしてのセキュリティ / AGENTS.md の規約。

サーバ側（`src/app`, 設定, CI）とクライアント側（`src/web`, `src/interfaces`）を2つのエージェントで並行レビューし、重複する指摘を統合した。

## 指摘一覧

| # | ドキュメント | 概要 | 重要度 |
|---|---|---|---|
| 01 | [01-server-crash-on-socket-handler.md](01-server-crash-on-socket-handler.md) | TDZ 例外・不正 payload で Socket.IO ハンドラが例外 → サーバプロセス停止 | high |
| 02 | [02-child-process-lifecycle.md](02-child-process-lifecycle.md) | 子プロセス/stdin の `error` 未処理、SIGKILL フォールバック不発、stdin 未 close、終了時の後始末なし | high |
| 03 | [03-resource-limits-dos.md](03-resource-limits-dos.md) | 同時実行数上限（`NOSPACE_MAX_PROCESSES`）未実装、出力量無制限（サーバ・クライアント双方） | high |
| 04 | [04-test-api-exposed.md](04-test-api-exposed.md) | テストファイル書き込み API が本番でも認証なしで公開 | high |
| 05 | [05-socket-reconnect-handling.md](05-socket-reconnect-handling.md) | Socket 再接続でリスナー重複登録、切断時の処理なし | high |
| 06 | [06-backend-init-race-and-failure.md](06-backend-init-race-and-failure.md) | flavor 切替時の backend init 競合、init/WASM ロード失敗が UI に出ない | high |
| 07 | [07-wasm-execution-safety.md](07-wasm-execution-safety.md) | stepBudget 無検証によるタブフリーズ、VM の use-after-free、`crypto.randomUUID` 依存 | high |
| 08 | [08-session-id-mismatch.md](08-session-id-mismatch.md) | 旧セッションのイベントが新セッションに混入（サーバ・クライアント双方） | medium |
| 09 | [09-test-editor-error-handling.md](09-test-editor-error-handling.md) | テストエディタの reject 未処理・競合・編集モード強制リセット | medium |
| 10 | [10-config-and-env.md](10-config-and-env.md) | `.env.example` を実行時設定に使用、設定値未検証、子プロセスへの環境変数継承 | medium |
| 11 | [11-ci-and-dependencies.md](11-ci-and-dependencies.md) | CI のアクション未固定・書き込み権限、依存の型/バージョン不整合 | medium |
| 12 | [12-design-srp-di.md](12-design-srp-di.md) | DI 迂回・責務過多・components の状態依存・エラー種別の文字列判定 | low |
| 13 | [13-agents-md-compliance.md](13-agents-md-compliance.md) | ドキュメントコメント欠落、グローバル差し替えによるテスト | low |
| 14 | [14-misc-low.md](14-misc-low.md) | localStorage 書き込み、エラー JSON 検証不足等 | low |

## 推奨対応順

1. 01（1リクエストでサーバ停止）→ 02 → 03 → 04（公開環境での DoS・改ざん）
2. 05 → 06 → 07（クライアントが操作不能になるもの）
3. 08 以降

## セキュリティ観点で問題なしと確認した項目

- XSS: `dangerouslySetInnerHTML` / `innerHTML` / `eval` の使用なし。出力は React テキストノード / `<textarea value>`。
- テストでの `jest.mock` / `jest.spyOn` によるメソッド差し替えなし（DI・フェイクで実装済み）。
- TestFileService のパストラバーサル対策（`resolve` + `relative` による検証）は存在する（シンボリックリンク経由は未対策 → 04 参照）。
