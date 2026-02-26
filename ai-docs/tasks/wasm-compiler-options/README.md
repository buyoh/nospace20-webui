# WASM コンパイラオプション拡張 UI

## 概要

WASM モジュールに新しいパラメータ（`std_extensions`, `opt_passes`）が追加された。
これらの新オプションを UI から設定できるようにする。

### 新しい WASM API パラメータ

| 関数 | 新パラメータ | 型 | 説明 |
|------|-------------|----|----|
| `compile()` | `std_extensions` | `StdExtension[] \| null` | 有効にする拡張（`"debug"`, `"alloc"`） |
| `compile()` | `opt_passes` | `OptPass[] \| null` | 有効にする最適化パス |
| `run()` | `opt_passes` | `OptPass[] \| null` | 有効にする最適化パス |
| `WasmWhitespaceVM()` | `std_extensions` | `StdExtension[] \| null` | 有効にする拡張 |

### WASM `getOptions()` から取得可能な値

```typescript
// OptionsDefinition
{
  compileTargets: ["ws", "mnemonic"],
  languageStds: ["standard", "ws"],
  stdExtensions: ["debug", "alloc"],
  optPasses: ["all", "condition-opt", "geti-opt", "constant-folding", "dead-code"],
}
```

### 旧 API との差分

- `compile()` の旧 `debug_ext: boolean`, `alloc_ext: boolean` → 新 `std_extensions: StdExtension[]`（配列化）
- `run()` に `opt_passes` パラメータ追加
- `WasmWhitespaceVM()` の旧 `debug_ext`, `alloc_ext` → 新 `std_extensions`

## 変更計画

### モジュール分割

以下の 3 モジュールに分けて段階的に実装する。

1. **[data-types.md](data-types.md)** — 型定義・Atom 変更（データ層）
2. **[ui-components.md](ui-components.md)** — UI コンポーネント変更
3. **[backend-integration.md](backend-integration.md)** — バックエンド連携（WASM 呼び出し側）

### 依存関係

```
data-types → ui-components
data-types → backend-integration
```

`data-types` を最初に実装し、`ui-components` と `backend-integration` は独立して実装可能。

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/interfaces/NospaceTypes.ts` | `CompileOptions`, `RunOptions` に新フィールド追加 |
| `src/web/stores/optionsAtom.ts` | atom 初期値に新フィールド追加 |
| `src/web/components/execution/CompileOptions.tsx` | `stdExtensions` チェックボックス群、`optPasses` チェックボックス群追加 |
| `src/web/components/execution/ExecutionOptions.tsx` | `optPasses` チェックボックス群追加（WASM 時のみ） |
| `src/web/services/WasmExecutionBackend.ts` | `compile()`, `run()`, VM コンストラクタに新パラメータ渡し |
| `src/web/hooks/useNospaceExecution.ts` | 新パラメータのデータフロー追加 |
| `src/tests/web/CompileOptions.spec.tsx` | 新 UI 要素のテスト追加 |
| `src/tests/web/WasmExecutionBackend.spec.ts` | 新パラメータ渡しのテスト追加 |
