# コードレビュー 2026-10-16

ソースコード・テストコード・設定ファイル全体を対象としたレビュー結果。
観点: 一般的な設計原則 / 安全性・エラー処理・フェイルセーフ / 外部公開アプリとしてのセキュリティ / AGENTS.md の規約。

サーバ側（`src/app`, 設定, CI）とクライアント側（`src/web`, `src/interfaces`）を2つのエージェントで並行レビューし、重複する指摘を統合した。

## 指摘一覧

| # | ドキュメント | 概要 | 重要度 | 状態 |
|---|---|---|---|---|
| 01 | [01-server-crash-on-socket-handler.md](01-server-crash-on-socket-handler.md) | TDZ 例外・不正 payload で Socket.IO ハンドラが例外 → サーバプロセス停止 | high | **一部完了**（TDZ・例外漏れ・書き込み失敗時の throw は解消。payload 全体のスキーマ検証は未対応） |
| 02 | [02-child-process-lifecycle.md](02-child-process-lifecycle.md) | 子プロセス/stdin の `error` 未処理、SIGKILL フォールバック不発、stdin 未 close、終了時の後始末なし | high | **一部完了**（(a) `error` イベント未処理は解消。(b)〜(e) は未対応） |
| 03 | [03-resource-limits-dos.md](../../done-tasks/code-review-2026-10-16/03-resource-limits-dos.md) | 同時実行数上限（`NOSPACE_MAX_PROCESSES`）未実装、出力量無制限（サーバ・クライアント双方） | high | **完了** |
| 04 | [04-test-api-exposed.md](04-test-api-exposed.md) | テストファイル書き込み API が本番でも認証なしで公開 | high | 未対応 |
| 05 | [05-socket-reconnect-handling.md](../../done-tasks/code-review-2026-10-16/05-socket-reconnect-handling.md) | Socket 再接続でリスナー重複登録、切断時の処理なし | high | **完了** |
| 06 | [06-backend-init-race-and-failure.md](../../done-tasks/code-review-2026-10-16/06-backend-init-race-and-failure.md) | flavor 切替時の backend init 競合、init/WASM ロード失敗が UI に出ない | high | **完了** |
| 07 | [07-wasm-execution-safety.md](07-wasm-execution-safety.md) | stepBudget 無検証によるタブフリーズ、VM の use-after-free、`crypto.randomUUID` 依存 | high | 未対応 |
| 08 | [08-session-id-mismatch.md](../../done-tasks/code-review-2026-10-16/08-session-id-mismatch.md) | 旧セッションのイベントが新セッションに混入（サーバ・クライアント双方） | medium | **完了** |
| 09 | [09-test-editor-error-handling.md](../../done-tasks/code-review-2026-10-16/09-test-editor-error-handling.md) | テストエディタの reject 未処理・競合・編集モード強制リセット | medium | **完了** |
| 10 | [10-config-and-env.md](10-config-and-env.md) | `.env.example` を実行時設定に使用、設定値未検証、子プロセスへの環境変数継承 | medium | 未対応 |
| 11 | [11-ci-and-dependencies.md](11-ci-and-dependencies.md) | CI のアクション未固定・書き込み権限、依存の型/バージョン不整合 | medium | 未対応 |
| 12 | [12-design-srp-di.md](12-design-srp-di.md) | DI 迂回・責務過多・components の状態依存・エラー種別の文字列判定 | low | 未対応 |
| 13 | [13-agents-md-compliance.md](13-agents-md-compliance.md) | ドキュメントコメント欠落、グローバル差し替えによるテスト | low | 未対応 |
| 14 | [14-misc-low.md](14-misc-low.md) | localStorage 書き込み、エラー JSON 検証不足等 | low | 未対応 |

完了した指摘（03 / 05 / 06 / 08 / 09）の設計・実装記録は [done-tasks/review-2026-10-16-fixes](../../done-tasks/review-2026-10-16-fixes/README.md)、
指摘ドキュメントは [done-tasks/code-review-2026-10-16](../../done-tasks/code-review-2026-10-16/README.md)。
未対応・積み残しの項目は [review-2026-10-16-followup.md](../review-2026-10-16-followup.md) にまとめている。

注意: 04（テストファイル書き込み API の公開）は、AGENTS.md に「node サーバを経由する native 実行環境は外部公開を想定しない」と追記されたため、重要度の見直しが必要。

## 推奨対応順

1. 01（1リクエストでサーバ停止）→ 02 → 03 → 04（公開環境での DoS・改ざん）
2. 05 → 06 → 07（クライアントが操作不能になるもの）
3. 08 以降

## セキュリティ観点で問題なしと確認した項目

- XSS: `dangerouslySetInnerHTML` / `innerHTML` / `eval` の使用なし。出力は React テキストノード / `<textarea value>`。
- テストでの `jest.mock` / `jest.spyOn` によるメソッド差し替えなし（DI・フェイクで実装済み）。
- TestFileService のパストラバーサル対策（`resolve` + `relative` による検証）は存在する（シンボリックリンク経由は未対策 → 04 参照）。
