# コードレビュー 2026-10-16 修正の積み残し

[review-2026-10-16-fixes](../done-tasks/review-2026-10-16-fixes/README.md) の実装レビューで挙がった、今回対応しなかった項目。

作成日: 2026-10-17
ステータス: 未着手

## 背景・動機

実装後のコードレビュー（2 回目）で、致命的ではない指摘が残った。いずれも元の設計で「対象外」とした項目、または影響が限定的な項目。

## 設計・方針

### 1. 子プロセスの終了処理（優先度: 高）

[code-review-2026-10-16/02](code-review-2026-10-16/02-child-process-lifecycle.md) の (b)〜(e) が未対応。特に (c) は、同時実行数の上限（`NOSPACE_MAX_PROCESSES`）を導入したことで影響が大きくなった。

- **SIGKILL フォールバックが発火しない**（`NospaceExecutionService.ts` の `kill()`）
  - `process.kill('SIGTERM')` が成功すると `process.killed` は true になるため、2 秒後の `!this.process.killed` は常に偽
  - SIGTERM を無視するプロセスは `close` せず `finalize()` も呼ばれず、実行枠が戻らない
  - 方針: `finalized` / `exitCode === null && signalCode === null` で判定し、フォールバックのタイマーを保持して `cleanup()` で解除する
- (b) stdin の EPIPE（`process.stdin.on('error')` 未登録）
- (d) batch モードで stdin を閉じない
- (e) SIGINT / SIGTERM 時の全セッション kill と一時ファイルの後始末

### 2. 再実行時のスロット占有

同一クライアントが Stop せずに再実行すると、旧プロセスの `close` までスロットが占有されたままになる（`NospaceController.killExistingSession`）。上限（既定 5）に達している状態では、自分の旧セッションのせいで「Server is busy」と拒否される。

- 方針案: kill 済みセッションのスロットは kill 時点で解放する（`finalize` 前に解放関数を呼ぶ。冪等のため二重解放にならない）

### 3. テストエディタ

- **新規作成フォームの入力破棄で確認が出ない**: `isDirty` はメインエディタ・check エディタの更新でしか立たず、フォームの category / fileName / check（`TestCaseCreateForm` のローカル state）の入力だけでは確認されない。方針: フォームから dirty を通知して合算する
- **読み込み中の画面**: `loadTestCase` が開始時に `testCase` を null にするため、保存直後の再読み込み等で一瞬「Select a test case to edit」になり、フォーカス・スクロールが失われる。方針: `isLoading` atom を追加し、読み込み中表示を出す

### 4. テスト

- `SocketFlowControl`: `highWaterPackets` の境界（`>=`）と `conn` 未定義時の挙動を、フェイクの conn で検証する
- `TestEditorErrorBanner` / `useDiscardChangesGuard` の単体テスト（現状は hook 経由のみ）

## タスクステップ・チェックリスト

1. [ ] 1: 子プロセスの終了処理（SIGKILL フォールバックを最優先）
2. [ ] 2: 再実行時のスロット占有
3. [ ] 3: テストエディタ（作成フォームの dirty、読み込み中表示）
4. [ ] 4: テスト追加

## 残存するコードレビュー指摘（今回の対象外）

[code-review-2026-10-16](code-review-2026-10-16/README.md) の 01（payload の全面的なスキーマ検証）、04、07、10〜14。
ただし 04（テストファイル書き込み API の公開）は、native 実行環境を外部公開しない前提（AGENTS.md）のため、重要度の見直しが必要。
