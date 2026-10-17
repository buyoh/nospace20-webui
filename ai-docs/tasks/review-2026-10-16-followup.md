# コードレビュー 2026-10-16 修正の積み残し

[review-2026-10-16-fixes](../done-tasks/review-2026-10-16-fixes/README.md) の実装レビューで挙がった、今回対応しなかった項目。

作成日: 2026-10-17
ステータス: 未着手

## 背景・動機

実装後のコードレビュー（2 回目）で、致命的ではない指摘が残った。いずれも元の設計で「対象外」とした項目、または影響が限定的な項目。

## 設計・方針

### 1. 子プロセスの終了処理

**完了**（[done-tasks/code-review-2026-10-16/02](../done-tasks/code-review-2026-10-16/02-child-process-lifecycle.md) で対応: SIGKILL フォールバック、stdin の EPIPE と close、`killAll` による終了時の後始末）。

### 2. 再実行時のスロット占有

同一クライアントが Stop せずに再実行すると、旧プロセスの `close` までスロットが占有されたままになる（`NospaceController.killExistingSession`）。上限（既定 5）に達している状態では、自分の旧セッションのせいで「Server is busy」と拒否される。

- 方針案: kill 済みセッションのスロットは kill 時点で解放する（`finalize` 前に解放関数を呼ぶ。冪等のため二重解放にならない）

### 3. テストエディタ

- **新規作成フォームの入力破棄で確認が出ない**: `isDirty` はメインエディタ・check エディタの更新でしか立たず、フォームの category / fileName / check（`TestCaseCreateForm` のローカル state）の入力だけでは確認されない。方針: フォームから dirty を通知して合算する
- **読み込み中の画面**: `loadTestCase` が開始時に `testCase` を null にするため、保存直後の再読み込み等で一瞬「Select a test case to edit」になり、フォーカス・スクロールが失われる。方針: `isLoading` atom を追加し、読み込み中表示を出す

### 4. テスト

- `SocketFlowControl`: `highWaterPackets` の境界（`>=`）と `conn` 未定義時の挙動を、フェイクの conn で検証する
- `TestEditorErrorBanner` / `useDiscardChangesGuard` の単体テスト（現状は hook 経由のみ）

### 5. テストファイル管理 API（優先度: 低。テスト環境のツールのため）

[done-tasks/code-review-2026-10-16/04](../done-tasks/code-review-2026-10-16/04-test-api-exposed.md) の実装レビューでの指摘。

- サーバー側が `TEST_FILE_NAME_PATTERN`（`[A-Za-z0-9_-]+`）を強制していない（UI のみ）。API を直接呼ぶと `.` 始まりや `foo.check` のような名前を作れる。方針: 最終要素をサーバー側でも検証する
- `createTestCase` の存在確認と書き込みの間の TOCTOU（同時 POST で後勝ちの上書き）。方針: 一時ファイルを `linkSync`（EEXIST で失敗）で配置する
- `TestController` のエラー分類が `error.message` の文字列一致。方針: `ValidationError` / `NotFoundError` を定義して `instanceof` で判定する（[code-review-2026-10-16/12](code-review-2026-10-16/12-design-srp-di.md) と共通）
- `fs.promises` 化（同期 fs が event loop を止める）

### 6. サーバー起動・終了のテスト

`Express.ts`（`setupExpressServer`）と `MainServer.ts` に対応するテストが無い。対象: `listen` の EADDRINUSE が reject になること、`vite` + `production` の拒否、`NOSPACE_TEST_DIR=''` でテスト API を登録しないこと、`shutdown()` の順序。`setupExpressServer` が `Http.createServer` を直接呼んでいるため、サーバー生成のファクトリを引数で受け取れるようにする必要がある。

### 7. 見送った項目（必要になったら対応）

- [02](../done-tasks/code-review-2026-10-16/02-child-process-lifecycle.md) 解決策 6: `existsSync` → `accessSync(X_OK)`（EACCES は `error` イベントで安全に処理されるため）
- [07](../done-tasks/code-review-2026-10-16/07-wasm-execution-safety.md) 解決策 2・3: step ごとの経過時間による budget 調整、Web Worker 化。巨大なソースのコンパイルが UI を固める問題が残る
- [10](../done-tasks/code-review-2026-10-16/10-config-and-env.md) (c): 子プロセスの環境変数の絞り込み
- [11](../done-tasks/code-review-2026-10-16/11-ci-and-dependencies.md): 外部アクションのコミット SHA 固定（現在はタグ）、CI への型チェック追加（既存のテストコードと ace のモード定義に型エラーがあり、先に解消が必要）

## タスクステップ・チェックリスト

1. [ ] 2: 再実行時のスロット占有
2. [ ] 3: テストエディタ（作成フォームの dirty、読み込み中表示）
3. [ ] 4: テスト追加
4. [ ] 5: テストファイル管理 API
5. [ ] 6: サーバー起動・終了のテスト

## 残存するコードレビュー指摘

[code-review-2026-10-16](code-review-2026-10-16/README.md) の 12・13・14。
