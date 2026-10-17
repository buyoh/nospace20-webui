# 09. テストエディタのエラー処理・状態同期の不備

- 重要度: **medium**
- 対象: `src/web/components/test-editor/TestEditorPanel.tsx`, `src/web/hooks/useTestEditor.ts`, `src/web/hooks/useTestTree.ts`, `src/web/hooks/useCheckResultEditor.ts`

## 問題点

### (a) 読み込み・保存失敗の未処理と競合

- `TestEditorPanel.tsx:51-55` の effect で `loadTestCase` の reject が未処理（`useTestEditor.ts:22-31` は catch 後に再 throw）→ unhandled rejection、画面は前のテストケースのまま
- `useTestEditor.ts:57-81` の handleSave / handleCreate は `console.error` のみ。保存失敗をユーザーが誤認しうる
- A→B と素早く選択するとレスポンス順序逆転で、B 選択中に A の内容が表示される（中断処理なし）
- dirty 状態で別テスト選択 / `startCreate` すると確認なしに編集内容が破棄される（`useTestEditor.ts:104-113`）

### (b) useCheckResultEditor の状態同期

`useCheckResultEditor.ts:56-75`, `:128-147`。

- JSON モードで編集中、有効な JSON になった瞬間 `onChange` → value 変化 → effect が `setEditMode('form')` を実行し、タイピング中にフォームモードへ強制的に戻る
- effect が `validationErrors` を再計算しないため、テストケース切替後も前のエラーが残る
- JSON が不正な間は `onChange` を呼ばないため、不正 JSON を表示したまま Save すると最後に有効だった JSON が保存される

### (c) 契約不整合

`TestTypes.ts:41` は「check が空文字ならファイル削除」と定義するが、`useTestEditor.ts:63` は `check || undefined` としているためクライアントから check.json を削除できない。

## 違反しているルール・原則

- エラーハンドリング、データ損失防止
- props → state 派生の設計（派生 state のリセット条件）
- インタフェース契約の一貫性

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | effect で `.catch` してエラー atom（例: `testEditorErrorAtom`）に格納・表示。`let ignore = true` パターン / AbortController で古いレスポンスを破棄 | `TestEditorPanel`, `useTestEditor`, 新規 atom |
| 2 | dirty 時の選択変更・新規作成で確認ダイアログ（`confirm` は DI） | `useTestTree.selectTest`, `startCreate` |
| 3 | editMode の初期化をテストケース切替時のみにする（親で `key={testCase.path}` を付け remount）。effect を削除/簡素化 | `TestCaseEditForm`, `TestCaseCreateForm`, `useCheckResultEditor` |
| 4 | 不正 JSON 中は `isValid` を上位に通知し Save を無効化 | `useCheckResultEditor`, `CheckResultEditor`, 各 Form |
| 5 | `check || undefined` を `check` に修正し、削除の意図を UI で明示 | `useTestEditor` |
