# UI コンポーネント変更

## 実装状況

- `CompileOptions.tsx` stdExtensions チェックボックス群: ✅ 実装済み
- `CompileOptions.tsx` optPasses チェックボックス群: ❌ 未実装
- `ExecutionOptions.tsx` optPasses チェックボックス群: ❌ 未実装
- `CompileOptions.spec.tsx` stdExtensions テスト: ✅ 実装済み
- `CompileOptions.spec.tsx` optPasses テスト: ❌ 未実装

## 概要

CompileOptions と ExecutionOptions コンポーネントに、新しいオプション（stdExtensions, optPasses）の UI を追加する。
選択肢は WASM の `getOptions()` から動的に取得する。

## 変更内容

### 1. `CompileOptions.tsx` — std_extensions / opt_passes 追加

#### 既存の `getWasmDerivedOptions()` を拡張

`getOptions()` の `stdExtensions` と `optPasses` もフォールバック付きで取得する。

```typescript
function getWasmDerivedOptions(): {
  languageOptions: OptionItem<LanguageSubset>[];
  targetOptions: OptionItem<CompileTarget>[];
  stdExtensionOptions: string[];
  optPassOptions: string[];
} {
  // ... 既存ロジックに stdExtensions/optPasses を追加
}
```

#### UI レイアウト

言語コンパイルオプション専用のオプションであるため、CompileOptions セクション内にチェックボックスを追加する。

```
Compile Options (CollapsibleSection)
├── Language: [Select]
├── Target: [Select]
├── Std Extensions: (チェックボックス群)
│   ├── ☐ debug
│   └── ☐ alloc
└── Optimization: (チェックボックス群)
    ├── ☐ all
    ├── ☐ condition-opt
    ├── ☐ geti-opt
    ├── ☐ constant-folding
    └── ☐ dead-code
```

**チェックボックスの動作**:
- チェック ON → 配列に値を追加
- チェック OFF → 配列から値を削除
- `getOptions()` から動的に取得した選択肢をすべて表示

**ラベル表示**: 値からラベルへのマッピングテーブルを用意する。未知の値はそのまま表示。

```typescript
const STD_EXTENSION_LABELS: Record<string, string> = {
  debug: 'Debug',
  alloc: 'Alloc',
};

const OPT_PASS_LABELS: Record<string, string> = {
  all: 'All',
  'condition-opt': 'Condition Opt',
  'geti-opt': 'GetI Opt',
  'constant-folding': 'Constant Folding',
  'dead-code': 'Dead Code',
};
```

### 2. `ExecutionOptions.tsx` — opt_passes 追加

Execution mode での実行時にも最適化パスを指定可能（WASM only）。

```
Execution Options (CollapsibleSection)
├── Debug trace: ☐
├── (WebSocket only) Ignore debug: ☐
├── (WebSocket only) Input Mode: [Select]
├── (WASM only) Step Budget: [Input]
├── (WASM only) Max Total Steps: [Input]
└── (WASM only) Optimization: (チェックボックス群)  ← 新規追加
    ├── ☐ all
    ├── ☐ condition-opt
    └── ...
```

**設計判断**: `stdExtensions` は Execution Options には表示しない。
`stdExtensions` は compile のみで使用されるパラメータであり、`run()` API には渡さない（ただし `WasmWhitespaceVM` コンストラクタには渡す）。
`WasmWhitespaceVM` コンストラクタへの `std_extensions` の渡しは、`compileOptionsAtom` の値を参照して backend-integration 側で処理する。

### 3. Props の依存性注入

テスト容易性のため、既存の `languageOptions` / `targetOptions` と同様に props で注入可能にする。

```typescript
interface CompileOptionsProps {
  languageOptions?: OptionItem<LanguageSubset>[];
  targetOptions?: OptionItem<CompileTarget>[];
  stdExtensionOptions?: string[];
  optPassOptions?: string[];
}
```

## テスト

### CompileOptions.spec.tsx に追加するテスト

- stdExtensions チェックボックスが表示される
- optPasses チェックボックスが表示される
- stdExtensions のチェックボックスを ON/OFF で atom の値が変化する
- optPasses のチェックボックスを ON/OFF で atom の値が変化する
- props による選択肢の注入が動作する
