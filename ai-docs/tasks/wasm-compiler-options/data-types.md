# データ型・Atom 変更

## 概要

`NospaceTypes.ts` の型定義と `optionsAtom.ts` の初期値を拡張し、新パラメータを扱えるようにする。

## 変更内容

### 1. `src/interfaces/NospaceTypes.ts`

#### CompileOptions

```typescript
export interface CompileOptions {
  /** Language subset */
  language: LanguageSubset;
  /** Compile output format */
  target: CompileTarget;
  /** 有効にする標準拡張 */
  stdExtensions: string[];
  /** 有効にする最適化パス */
  optPasses: string[];
}
```

#### RunOptions

```typescript
export interface RunOptions {
  /** Language subset */
  language: LanguageSubset;
  /** Enable debug trace */
  debug: boolean;
  /** Disable debug built-in functions */
  ignoreDebug: boolean;
  /** Standard input mode */
  inputMode: InputMode;
  /** WASM only: 1回の vm.step() コールで実行する命令数 */
  stepBudget?: number;
  /** WASM only: 最大総実行ステップ数 */
  maxTotalSteps?: number;
  /** 有効にする最適化パス（WASM only） */
  optPasses?: string[];
}
```

**設計判断**: `stdExtensions` / `optPasses` の値型は `string[]` とする。
WASM 側の `StdExtension` / `OptPass` 型は WASM モジュール内部の型であり、
アプリケーション層の型定義が WASM のバージョンに強く依存しないようにするため。
`getOptions()` が返す値をそのまま表示・選択可能にする。

### 2. `src/web/stores/optionsAtom.ts`

```typescript
export const compileOptionsAtom = atom<CompileOptions>({
  language: 'standard',
  target: 'ws',
  stdExtensions: [],
  optPasses: [],
});
```

`executionOptionsAtom` は `RunOptions` とは別の型 (`ExecutionOptions`) を使っているため、
`ExecutionOptions` にも `optPasses` を追加する。

```typescript
export interface ExecutionOptions {
  debug: boolean;
  ignoreDebug: boolean;
  inputMode: InputMode;
  stepBudget: number;
  maxTotalSteps: number;
  /** 有効にする最適化パス（WASM only） */
  optPasses: string[];
}
```

初期値:
```typescript
export const executionOptionsAtom = atom<ExecutionOptions>({
  debug: false,
  ignoreDebug: false,
  inputMode: 'batch',
  stepBudget: 10000,
  maxTotalSteps: 100_000_000,
  optPasses: [],
});
```

## テスト影響

- 既存テストで `CompileOptions` や `ExecutionOptions` のオブジェクトを直接構築している箇所は、新フィールドが必要になる可能性がある。
- 型エラーによりコンパイル時に検出されるため、修正は容易。
