# WASM getOptions() を使ったコンパイルオプション動的取得

## 概要

コンパイラ・ランタイムに指定可能なオプション（コンパイルターゲット、言語サブセット）を
ハードコードからWASMモジュールの `getOptions()` による動的取得に変更。

## 変更内容

### src/web/libs/nospace20/loader.ts
- `Nospace20Module` 型に `getOptions` を追加

### src/web/components/execution/CompileOptions.tsx
- `getWasmDerivedOptions()` ヘルパー関数を追加
  - WASM 初期化済みなら `getOptions()` から選択肢を構築
  - 未初期化時はフォールバック定数を返す
- ラベルマッピング（`LANGUAGE_LABELS`, `TARGET_LABELS`）を定義し、未知の値はそのまま表示
- `useMemo` でマウント時に1回だけ計算

## テスト

- 既存の CompileOptions テスト 6件がすべてパス
- 全テストスイート 356件パス（リグレッションなし）

## 状態

完了
