# コードレビュー 2026-10-16 指摘の修正（03 / 05 / 06 / 08 / 09）

[code-review-2026-10-16](../code-review-2026-10-16/README.md) の指摘のうち、実行系の堅牢性（リソース上限・再接続・初期化競合・セッション混線）とテストエディタのエラー処理について修正方針を定める。

作成日: 2026-10-16
ステータス: 設計完了（未実装）

## 背景・動機

- 実行系はサーバ・クライアント双方で「異常系・非同期イベント順序」への耐性が低く、操作不能状態（Run/Stop が押せない）やサーバ資源の枯渇が起こりうる
- テストエディタは失敗時に何も通知せず、編集内容の喪失や意図しない保存が起こりうる

## 対象指摘とドキュメント

| ドキュメント | 元指摘 | 概要 | 重要度 |
|---|---|---|---|
| [01-session-request-id.md](01-session-request-id.md) | [08](../code-review-2026-10-16/08-session-id-mismatch.md) | requestId による実行リクエストとイベントの対応付け、セッション登録の保護 | medium |
| [02-backend-lifecycle-state.md](02-backend-lifecycle-state.md) | [06](../code-review-2026-10-16/06-backend-init-race-and-failure.md) | backend 初期化の競合解消、初期化状態の UI 表示と再試行 | high |
| [03-socket-reconnect.md](03-socket-reconnect.md) | [05](../code-review-2026-10-16/05-socket-reconnect-handling.md) | Socket 再接続時のリスナー重複解消、切断時の状態復帰 | high |
| [04-resource-limits.md](04-resource-limits.md) | [03](../code-review-2026-10-16/03-resource-limits-dos.md) | 同時実行数上限、出力量上限（サーバ・クライアント） | high |
| [05-test-editor-robustness.md](05-test-editor-robustness.md) | [09](../code-review-2026-10-16/09-test-editor-error-handling.md) | テストエディタのエラー通知・競合・状態同期・check 削除契約 | medium |

ドキュメント番号は**実装順**を表す（元指摘の番号とは異なる）。

## 共通設計

### A. requestId（01 で導入、04 で利用）

クライアントが `run` / `compile` ごとに `requestId` を生成して送信し、サーバはそのリクエストに起因する全イベントに `requestId` を付けて返す。クライアントは「現在のリクエスト」以外のイベントを捨てる。

- 旧セッションのイベント混入を、イベント到着順に依存せず排除できる
- サーバがセッション生成前にリクエストを拒否する場合（04 の同時実行数上限）でも、クライアントは requestId で応答を対応付けられる

### B. backend 状態 atom（02 で導入、03 で利用）

```ts
// src/web/stores/executionAtom.ts
export type BackendState =
  | { kind: 'initializing' }
  | { kind: 'ready' }
  | { kind: 'disconnected' }          // websocket: 接続断（自動再接続中）
  | { kind: 'error'; message: string }; // 初期化失敗（再試行可能）
export const backendStateAtom = atom<BackendState>({ kind: 'initializing' });
```

Run / Compile ボタンの有効条件は `backendState.kind === 'ready' && !isRunning` に統一する。

## 前提・他指摘との関係

| 関連指摘 | 関係 | 扱い |
|---|---|---|
| [01 サーバ停止（TDZ・payload 未検証）](../code-review-2026-10-16/01-server-crash-on-socket-handler.md) | 本タスクはコントローラーのコールバックを変更する。現状コールバックは `run()` の戻り値 `session` を参照しており、同期 `onExit` で TDZ 例外になる | **本タスクの 01 で TDZ・一時ファイル書き込み失敗時の throw・Controller の例外漏れを解消する**。payload の全面的な検証は対象外とし、本タスクで追加するフィールド（`requestId`）のみ検証する。不正 payload（`payload` 欠落等）による TypeError は Controller の try/catch で捕捉されるため、プロセス停止は防がれる |
| [02 子プロセスのライフサイクル](../code-review-2026-10-16/02-child-process-lifecycle.md) | 04 の同時実行数カウントはプロセス終了（`close` / `error`）までスロットを占有する | (a) `error` 未処理は **04 で解消**（`finalize()` を `error` からも呼ぶ）。(b) stdin EPIPE、(c) SIGKILL フォールバック、(d) batch stdin 未 close、(e) 終了時の後始末は対象外。特に (c) は SIGTERM を無視するプロセスがスロットを恒久占有するため、本タスク直後に対応すること |
| [07 WASM 実行の安全性](../code-review-2026-10-16/07-wasm-execution-safety.md) | 01 のクライアント ID 生成で `crypto.randomUUID` を使うと secure context 問題が波及する | 01 では ID 生成器を DI し、既定実装は `crypto.randomUUID` に依存しない |

## タスクステップ・チェックリスト

1. [ ] 01: requestId 導入とセッション登録の保護（サーバ・クライアント・interfaces）
2. [ ] 02: backend ライフサイクルと状態表示
3. [ ] 03: Socket 再接続・切断処理（02 の `backendStateAtom` を利用）
4. [ ] 04: リソース上限（01 の requestId を利用）
5. [ ] 05: テストエディタ（他と独立。並行実施可）
6. [ ] 各ステップで `npm test` / `npx tsc --noEmit` / lint を通す
7. [ ] 完了後、`code-review-2026-10-16/` の該当指摘に完了を記載

## 対象外（将来タスク）

- IP 単位の接続数・実行頻度制限（`io.use` ミドルウェア）
- コンテナ / cgroup によるメモリ・CPU 制限（デプロイ側）
- Socket.IO payload 全体のスキーマ検証（元指摘 01 の解決策 3）
