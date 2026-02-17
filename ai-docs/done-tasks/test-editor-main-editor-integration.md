# テストエディタ: ソースコードをメインエディタに表示

## 概要

テストケースのソースコード (.ns) を専用領域ではなく、画面左のメインエディタに表示するように変更

## 実装日

2026年2月17日

## 変更内容

### 1. operationMode の共有化

- `src/web/stores/testEditorAtom.ts` に `operationModeAtom` を追加
- ExecutionContainer で使用していた `operationMode` を atom で管理するように変更
- これにより、EditorContainer も現在のモードを知ることができる

### 2. EditorContainer の拡張

- `src/web/containers/EditorContainer.tsx` を修正
- テストエディタモード時には `editingTestCaseAtom.source` を表示
- 変更時には `useTestEditor().updateSource` を呼び出し
- それ以外のモードでは従来通り `sourceCodeAtom` を使用

### 3. テストケース編集フォームの簡素化

- `src/web/components/test-editor/TestCaseEditForm.tsx`
  - Source (.ns) セクションを削除
  - `CodeTextarea` のインポートも削除
  - 期待結果 (.check.json) のみを編集するフォームに変更

- `src/web/components/test-editor/TestCaseCreateForm.tsx`
  - Source (.ns) セクションを削除
  - source は props として受け取るのみ（表示はメインエディタで行う）

### 4. テストエディタパネルの調整

- `src/web/components/test-editor/TestEditorPanel.tsx`
  - `TestCaseEditForm` への `onSourceChange` プロップを削除
  - `TestCaseCreateForm` に `source` プロップを渡すように変更

### 5. 新規作成モードの改善

- `src/web/hooks/useTestEditor.ts`
  - `startCreate()` で空のテストケースを `editingTestCaseAtom` に設定
  - これにより、新規作成時もメインエディタでソースコードを入力できる

## テスト結果

- 既存のテスト: 全て PASS (194 tests)
- ビルド: 成功
- 型チェック: エラーなし

## 利点

1. **一貫したUI**: 通常のコード編集とテストケース編集で同じエディタを使用
2. **画面スペースの有効活用**: 右パネルに大きなエディタが不要になり、check.json に集中できる
3. **エディタ機能の統一**: メインエディタの機能（シンタックスハイライト等）が自動的に利用可能
