# 06. 実行バックエンド初期化の競合と失敗時の無通知

- 重要度: **high**（(a)）/ medium（(b)）
- 対象: `src/web/hooks/useExecutionBackend.ts`, `src/web/hooks/useNospaceExecution.ts`, `src/web/libs/nospace20/loader.ts`

## 問題点

### (a) init 完了後に `cancelled` を確認していない（high）

`useExecutionBackend.ts:71-141`。`cancelled` は factory の await 直後でしか確認されず、`await backend.init()` 後（`:121-132`）は無条件に
`backendRef.current?.dispose(); backendRef.current = backend;` を実行する。

失敗シナリオ: websocket に切替（接続最大 10 秒）→ 完了前に wasm に戻す → wasm が先に backendRef に入る → 後から websocket の init が完了し、wasm backend を dispose して websocket backend に置き換わる。
Header は WASM 表示なのに実行はサーバに飛び、capabilities も食い違う。アンマウント後に init が完了した場合も backend がリークする。

### (b) init / WASM ロード失敗が UI に表示されず、再試行もできない（medium）

- `useExecutionBackend.ts:74-75`: factory（動的 import）の reject を catch しておらず unhandled rejection
- `:121-128`: init 失敗時も `console.error` のみでその backend を採用
- `useNospaceExecution.ts:105-112`: `console.warn` のみで return。Run を押しても何も起きず理由も出ない
- `loader.ts:34-40`: reject 済み `initPromise` をキャッシュし続け、flavor 切替でも再試行されずリロードまで復旧しない

## 違反しているルール・原則

- 非同期 effect の cleanup / race 対策
- フェイルセーフ UI、エラーハンドリング

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | init 後にも `if (cancelled) { backend.dispose(); return; }` を追加 | 本 hook のみ。テスト1ケース追加 |
| 2 | effect ローカル変数で backend を保持し cleanup でそれを dispose。`backendRef` を共有可変状態として使わない | hook 内部のみ |
| 3 | IIFE 全体を try/catch し、`backendStatusAtom`（`loading` / `ready` / `error` + message）に反映。ボタン無効化とエラー表示 | hook, `ExecutionControls` / `ExecutionContainer` |
| 4 | loader の失敗時に `initPromise = null` に戻して再試行可能にする | `loader.ts` のみ |
