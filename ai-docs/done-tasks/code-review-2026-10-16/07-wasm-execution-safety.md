# 07. WASM 実行の安全性（メインスレッドブロック・VM 解放・ID 生成）

- 重要度: **high**（(a)）/ medium（(b)(c)）
- 対象: `src/web/services/WasmExecutionBackend.ts`, `src/web/components/execution/ExecutionOptions.tsx`

## 問題点

### (a) stepBudget 無検証でタブがフリーズする（high）

`ExecutionOptions.tsx:70-78`, `:88-98` は `Number(e.target.value)` をそのまま atom に設定。HTML の `min` / `max` 属性は手入力値を強制しない。

- 巨大値（例: 1e12）や負数（wasm-bindgen の u32 変換で巨大値になる可能性、要確認）で無限ループのプログラムを Run すると、1 回の `adapter.step()` が戻らずタブがフリーズ。kill は abort フラグを見るだけなので Stop も効かない
- 空欄 → `Number('') === 0` → `step(0)` を `setTimeout(0)` で永久に繰り返し、`totalSteps` も増えず上限に達しない。CPU を消費し続ける
- `compile()` と VM コンストラクタ（内部でコンパイル）もメインスレッドで同期実行され、巨大ソースで UI が固まる

### (b) `this.vm` 共有による use-after-free（medium・現状 UI ガードで未到達）

`WasmExecutionBackend.ts:115-199`。`run()` は既存実行を kill すると謳うが、旧ループの `finally { this.vm?.free(); this.vm = null; }` は**その時点の `this.vm`（新しい VM）を解放**する。新ループの次の `step()` は解放済み VM にアクセスする。
現状は `useNospaceExecution` の `isRunning` ガードで UI から到達しないが、backend 単体の契約として壊れている。
また dispose 後も callback が解除されず、flavor 切替後に旧 backend の `[WASM execution killed]` が新しい出力に流れ込む。

### (c) `crypto.randomUUID` が secure context 依存（medium・公開形態次第）

`WasmExecutionBackend.ts:119`, `:287`。HTTPS / localhost 以外（HTTP で公開）では `crypto.randomUUID` が undefined となり、`run()` / `compile()` が TypeError を投げて WASM 実行が一切できなくなる。
テスト（`WasmExecutionBackend.spec.ts:94-98`）は `globalThis.crypto` を差し替えているため検出できない。

## 違反しているルール・原則

- 入力検証、メインスレッドブロッキングの回避
- リソース所有権の明確化（共有可変フィールドの解放）
- 依存の注入（グローバル API への直接依存）

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | atom 書き込み時または `run()` 冒頭で stepBudget / maxTotalSteps を clamp（例: `1 ≤ stepBudget ≤ 1e6`、NaN は既定値） | `ExecutionOptions` または `WasmExecutionBackend` のみ |
| 2 | 1 step あたりの経過時間を測り budget を動的調整（目安 16ms） | `WasmExecutionBackend` のみ |
| 3 | WASM 実行を Web Worker へ移し、kill を `worker.terminate()` で確実に行う（根本対策） | 大: loader, backend, vite 設定, テスト |
| 4 | vm をループのローカル変数で保持し finally でローカルを free。dispose で callback を null 化 | `WasmExecutionBackend` 内部のみ |
| 5 | ~~ID 生成器をコンストラクタで DI（既定は連番）。テストのグローバル差し替えを削除~~ | `WasmExecutionBackend`, テスト |

### 追加補足

- `createDefaultRequestIdGenerator` が `src/web/services/ServerExecutionBackend.ts` で定義されている。これを lib に移動し、`WasmExecutionBackend` でも同じものを使用する。
- `crypto.randomUUID` が使えるなら使う。

## 対応状況（2026-10-17）

**完了**（解決策 2・3 を除く）。解決策 5（ID 生成器のコンストラクタ DI）は対象外。

| 解決策 | 状態 | 内容 |
|---|---|---|
| 1 | 完了 | `src/web/libs/executionLimits.ts` を新設。`run()` の冒頭で stepBudget を 100〜1,000,000、maxTotalSteps を 1,000〜10,000,000,000 に収める（UI の min/max と同じ範囲）。NaN・未指定・数値以外は既定値 |
| 2 / 3 | **見送り** | 動的な budget 調整・Web Worker 化。範囲制限（1）で 1 回の step の最大時間を抑える。巨大な入力のコンパイルが UI を固める問題は残る |
| 4 | 完了 | VM をループのローカル変数で保持して finally で解放（二重解放も防止）。`dispose()` で callback を null 化。さらに、`run()` で置き換えられた旧実行の `killed` 通知が、新しい実行の状態を上書きしないようにした |
| 5（追加補足） | 完了 | `createDefaultRequestIdGenerator` を `src/web/libs/requestId.ts` に移し、`ServerExecutionBackend` と `WasmExecutionBackend` で共用。`crypto.randomUUID` が使えるなら使い、使えない環境（HTTP 配信）では時刻・連番・乱数にフォールバックする |

- テスト: `executionLimits.spec`・`requestId.spec`・`WasmExecutionBackendLifecycle.spec`（新規）
