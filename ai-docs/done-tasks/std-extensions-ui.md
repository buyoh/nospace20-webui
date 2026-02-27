# stdExtensions 設定 UI の追加

## 概要

CompileOptions コンポーネントに `stdExtensions` のチェックボックス UI を追加し、
WASM の `compile()` および `WasmWhitespaceVM` コンストラクタに `std_extensions` パラメータを渡すようにした。

## 変更内容

### データ型・Atom
- `CompileOptions` に `stdExtensions: string[]` を追加
- `compileOptionsAtom` の初期値に `stdExtensions: []` を追加

### UI（CompileOptions.tsx）
- `STD_EXTENSION_LABELS` ラベルマッピングを追加
- `getWasmDerivedOptions()` に `stdExtensionOptions` を追加（`getOptions().stdExtensions` から取得）
- チェックボックス群を描画する UI を追加
- `stdExtensionOptions` を props で注入可能に

### バックエンド連携
- `ExecutionBackend.run()` に `stdExtensions` パラメータを追加
- `WasmExecutionBackend.compile()` で `stdExtensions` を `nospace20.compile()` に渡す
- `WasmExecutionBackend.runAsync()` で `stdExtensions` を `WasmWhitespaceVM` コンストラクタに渡す
- `useNospaceExecution.handleRun()` で `compileOptions.stdExtensions` を渡す

### テスト
- CompileOptions: stdExtensions チェックボックスの表示・ON/OFF・props 注入・空配列の非表示 (5件追加)
- WasmExecutionBackend: compile/run での stdExtensions の渡し・空配列時 null (5件追加)
- 既存テストの CompileOptions オブジェクトに `stdExtensions` フィールドを追加

## テスト結果

全29スイート、366テストパス

## 状態

完了
