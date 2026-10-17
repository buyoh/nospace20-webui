# 01. Socket.IO ハンドラの例外でサーバプロセスが停止する

- 重要度: **high**
- 対象: `src/app/Controllers/NospaceController.ts`, `src/app/Services/NospaceExecutionService.ts`

## 問題点

### (a) 同期 `onExit` 呼び出しによる TDZ 例外

`NospaceExecutionService.compile()` / `run()` は、未サポートの compile target（`ex-ws`）やバイナリ未検出の場合に `callbacks.onStderr` / `callbacks.onExit` を**同期的に**呼ぶ（`NospaceExecutionService.ts:222-238`, `:300-321`）。

一方 `NospaceController.handleRun` / `handleCompile` のコールバックは、戻り値の `const session` を参照している（`NospaceController.ts:59-81`, `:125-147`）。
同期呼び出し時点で `session` は未初期化のため `ReferenceError: Cannot access 'session' before initialization` が発生する。

socket.io 4.x はイベントハンドラを `process.nextTick` 経由で呼ぶため、この例外は `uncaughtException` となり **Node プロセスが終了する**（レビュー時に再現済み）。
`writeFileSync` 失敗時の `throw error`（`:293`）も同じ経路で停止する。

攻撃シナリオ: `socket.emit('nospace_compile', { code: '', options: { target: 'ex-ws', ... } })` を1回送るだけで全利用者のサーバが停止する。

付随バグ: 同期経路では `onExit` 内の `removeSession` が `sessions.set(errorSession)` より先に走るため、errorSession が Map に残りメモリリークする。

### (b) Socket.IO payload の実行時検証がない

TypeScript の型は実行時に保証されない。`NospaceController.ts:16-33`, `:94`, `:170` で

- payload なし（`socket.emit('nospace_run')`）→ `payload.code` で TypeError
- `options` undefined → `options.inputMode` で TypeError
- `nospace_stdin` の `data` が非文字列 → `data.endsWith` で TypeError
- `stdExtensions` に文字列 → 1文字ずつ `--std-ext` に展開される

いずれも (a) と同じ経路でプロセスが終了する。

### テストの欠落

コントローラーのテストはフェイクサービスで `onExit` を非同期に呼ぶ前提のため、同期経路を検出できていない。

## 違反しているルール・原則

- フェイルセーフ設計（1リクエストの異常が全体に波及）
- 信頼境界での入力検証
- コールバック契約（同期/非同期）の不明確さ
- AGENTS.md: バグ修正時にテストケースを追加すること（修正時に対応が必要）

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | サービス側でエラー通知を非同期化（`queueMicrotask` / `process.nextTick`）し、`sessions.set` を通知より前に行う | `NospaceExecutionService`、同テストの期待順序 |
| 2 | コントローラーで sessionId を先に決め、コールバックが戻り値に依存しない設計にする（例: callbacks に sessionId を渡す / `run(sessionId, ...)`） | サービス API、コントローラー、両テスト |
| 3 | payload の Validator モジュールを新設（SRP）。`language` / `target` / `stdExtensions` を許可リストで判定し、不正なら `nospace_error` 等を返して無視 | 新規 Validator、`NospaceController`、`src/interfaces`（必要ならスキーマ定義） |
| 4 | 安全網として全 socket ハンドラを try/catch で包むラッパーを導入し、`process.on('uncaughtException')` でログ | `ExpressSocketIO.ts`, `NospaceController.ts`, `MainServer.ts` |

推奨: 1 または 2 で根本修正 + 3 + 4（多層防御）。
テスト: 同期 `onExit` を呼ぶフェイクサービスでの Controller テスト、不正 payload のテストを追加。

## 対応状況（2026-10-17）

**完了**。(a) は先行タスク（[review-2026-10-16-fixes/01](../../done-tasks/review-2026-10-16-fixes/01-session-request-id.md)）で解消済み。(b) を本タスクで対応した。

| 解決策 | 状態 | 内容 |
|---|---|---|
| 1 / 2 | 完了（先行タスク） | コールバックに sessionId・status を渡し、戻り値に依存させない。`sessions.set` を通知より前に行う |
| 3 | 完了 | `RequestValidator`（`src/app/Controllers/RequestValidator.ts`）を新設。`language` / `target` / `inputMode` は許可リスト、`stdExtensions` / `optPasses` は名前の形式（先頭が英数字・アンダースコア、最大 32 文字、最大 16 件）で検証し、検証済みの値だけを詰め替えて渡す。不正な要求は、プロセスを起動せず requestId 付きのエラーで拒否する |
| 4 | 完了 | 全ハンドラの try/catch（先行タスク）に加え、`MainServer` に `uncaughtException` / `unhandledRejection` のログ出力を追加（他の利用者の実行を巻き込んで停止しないための安全網） |

- 拡張名を固定の許可リストにしなかった理由: 利用可能な拡張・最適化パスの名前は nospace20 の版に依存する。固定リストは版の更新で陳腐化するため、CLI 引数として渡しても「オプション」と解釈されない形式に限定し、未知の名前は CLI のエラーに任せる。
- テスト: `RequestValidator.spec`（新規）、`NospaceController.spec`（不正 payload・許可外の値・想定外フィールドの除去）
