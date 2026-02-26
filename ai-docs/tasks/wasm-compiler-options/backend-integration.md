# バックエンド連携（WASM 呼び出し変更）

## 概要

`WasmExecutionBackend` と `useNospaceExecution` を更新し、新しいオプション（`stdExtensions`, `optPasses`）を
WASM 関数に渡すようにする。

## 変更内容

### 1. `WasmExecutionBackend.ts`

#### `compile()` メソッド

現在:
```typescript
const result = nospace20.compile(code, options.target, options.language);
```

変更後:
```typescript
const result = nospace20.compile(
  code,
  options.target,
  options.language,
  options.stdExtensions.length > 0 ? options.stdExtensions : null,
  options.optPasses.length > 0 ? options.optPasses : null,
);
```

#### `runAsync()` メソッド — VM 構築部分

現在:
```typescript
if (options.language === 'ws') {
  this.vm = nospace20.WasmWhitespaceVM.fromWhitespace(code, stdinData);
} else {
  this.vm = new nospace20.WasmWhitespaceVM(code, stdinData);
}
```

変更後:
```typescript
if (options.language === 'ws') {
  this.vm = nospace20.WasmWhitespaceVM.fromWhitespace(code, stdinData);
} else {
  this.vm = new nospace20.WasmWhitespaceVM(
    code,
    stdinData,
    null,  // interactive
    options.stdExtensions?.length ? options.stdExtensions : null,
  );
}
```

**注意**: `run()` では `stdExtensions` は `RunOptions` に含まれていないため、別途 `compileOptionsAtom` から取得する必要がある。
→ `useNospaceExecution` で `compileOptions.stdExtensions` を `RunOptions` まわりで参照するか、
`WasmExecutionBackend.run()` に追加パラメータとして渡すかを選択する。

**設計判断**: `RunOptions` に `stdExtensions` フィールドを追加するのではなく、
`useNospaceExecution.handleRun()` で `compileOptionsAtom.stdExtensions` を参照して直接渡す。
理由: `stdExtensions` はソースコードのコンパイル方法に関するオプションで、ランタイムのオプションではないが、
WASM flavor の `WasmWhitespaceVM` コンストラクタがコンパイルと実行を一体で行うため必要。

→ 具体的には `WasmExecutionBackend.run()` の第4引数として `stdExtensions` を追加する :

```typescript
run(code: string, options: RunOptions, stdinData?: string, stdExtensions?: string[]): void
```

`ExecutionBackend` インターフェースにも同様に追加。

#### `run()` の `opt_passes` パラメータ

WASM `run()` 関数にも `opt_passes` を渡す。ただし、WASM の `run()` 関数は直接使用していない
（代わりに `WasmWhitespaceVM` を構築して step 実行する方式）。
したがって、`opt_passes` の反映箇所は以下のみ:

- `compile()` — `nospace20.compile()` に `opt_passes` を渡す
- `runAsync()` — 現在 `WasmWhitespaceVM` コンストラクタには `opt_passes` パラメータがないため**不要**

### 2. `useNospaceExecution.ts`

#### `handleRun()`

```typescript
backend.run(
  sourceCode,
  {
    language: compileOptions.language,
    debug: executionOptions.debug,
    ignoreDebug: executionOptions.ignoreDebug,
    inputMode: executionOptions.inputMode,
    stepBudget: executionOptions.stepBudget,
    maxTotalSteps: executionOptions.maxTotalSteps,
    optPasses: executionOptions.optPasses,  // 追加（ただし VM コンストラクタには渡さない）
  },
  stdinData,
  compileOptions.stdExtensions,  // 追加
);
```

#### `handleCompile()`

`compileOptions` は既に `stdExtensions` と `optPasses` を含む。
`backend.compile(sourceCode, compileOptions)` はそのまま動作する。

## テスト

### WasmExecutionBackend.spec.ts に追加するテスト

- `compile()` で `stdExtensions` が `nospace20.compile()` に渡される
- `compile()` で `optPasses` が `nospace20.compile()` に渡される
- VM 構築時に `stdExtensions` が `WasmWhitespaceVM` コンストラクタに渡される
- 空配列の場合は `null` が渡される
