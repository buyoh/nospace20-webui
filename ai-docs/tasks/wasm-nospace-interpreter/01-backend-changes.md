# WasmExecutionBackend の変更設計

## 概要

`WasmExecutionBackend.run()` メソッドに `WasmNospaceVM` を使ったインタプリタ実行パスを追加する。

## 現状

現在の `run()` メソッドは以下のロジックで VM を構築している:

```typescript
if (options.language === 'ws') {
  this.vm = nospace20.WasmWhitespaceVM.fromWhitespace(code, stdinData);
} else {
  this.vm = new nospace20.WasmWhitespaceVM(code, stdinData, null, stdExtensions);
}
```

- `language === 'ws'` → Whitespace ソースを直接実行
- `language === 'standard'` → nospace をコンパイル → Whitespace VM で実行

どちらの場合も `WasmWhitespaceVM` を使用しており、`WasmNospaceVM` は未使用。

## 変更方針

### VM 選択ロジックの拡張

`RunOptions` に新しいフラグ `useNospaceVm` を追加するのではなく、
**`language` の値と実行モードに基づいて自動的に VM を選択**する方針とする。

Run(Direct) モードでは `language` が `'standard'` の場合に `WasmNospaceVM` を使用する。
Run モードでは従来通り `WasmWhitespaceVM`（コンパイル→WS実行）パスを使う。

ただし、Run(Direct) は `WasmExecutionBackend` 内部で区別する必要があるため、
`RunOptions` に `direct` フラグを追加する。

### RunOptions の拡張

```typescript
// src/interfaces/NospaceTypes.ts
export interface RunOptions {
  // ... 既存フィールド
  /** WasmNospaceVM を使用した直接インタプリタ実行を行うか（WASM only） */
  direct?: boolean;
}
```

### run() メソッドの変更

```typescript
private async runAsync(...): Promise<void> {
  const nospace20 = this.loader.getNospace20();

  try {
    if (options.language === 'ws') {
      // Whitespace ソース直接実行
      this.vm = nospace20.WasmWhitespaceVM.fromWhitespace(code, stdinData);
      await this.runWhitespaceVmLoop(signal, stepBudget, maxTotalSteps, sessionId, options);
    } else if (options.direct) {
      // NospaceVM で直接インタプリタ実行
      this.vm = new nospace20.WasmNospaceVM(
        code,
        stdinData,
        options.optPasses?.length ? options.optPasses : null,
        options.ignoreDebug ?? null,
      );
      await this.runNospaceVmLoop(signal, stepBudget, maxTotalSteps, sessionId, options);
    } else {
      // 従来: nospace → Whitespace コンパイル → WS VM 実行
      this.vm = new nospace20.WasmWhitespaceVM(code, stdinData, null, ...);
      await this.runWhitespaceVmLoop(signal, stepBudget, maxTotalSteps, sessionId, options);
    }
  } catch (e) { ... }
}
```

### runNospaceVmLoop の実装

`WasmNospaceVM` と `WasmWhitespaceVM` で API が微妙に異なるため、
共通部分をまとめつつ、VM 固有の差異を吸収する。

主な差異:
- stdout flush: `WasmNospaceVM.flushStdout()` vs `WasmWhitespaceVM.flush_stdout()`
- 完了時: `WasmNospaceVM.getReturnValue()` で戻り値取得可能
- トレース: `WasmNospaceVM.getTraced()` vs `WasmWhitespaceVM.get_traced()`
- total steps: いずれも `total_steps()`

#### 実装アプローチ: VM アダプターで差異を吸収

ステップ実行ループの重複を避けるため、VM のメソッド名の差異を吸収する
軽量アダプターインターフェースを導入する。

```typescript
/** ステップ実行ループ用 VM アダプタ */
interface VmAdapter {
  step(budget: number): VmStepResult;
  flushStdout(): string;
  getTraced(): any;
  totalSteps(): number;
  free(): void;
}

/** WasmWhitespaceVM をアダプタ化 */
function adaptWhitespaceVm(vm: any): VmAdapter {
  return {
    step: (b) => vm.step(b),
    flushStdout: () => vm.flush_stdout(),
    getTraced: () => vm.get_traced(),
    totalSteps: () => vm.total_steps(),
    free: () => vm.free(),
  };
}

/** WasmNospaceVM をアダプタ化 */
function adaptNospaceVm(vm: any): VmAdapter {
  return {
    step: (b) => vm.step(b),
    flushStdout: () => vm.flushStdout(),
    getTraced: () => vm.getTraced(),
    totalSteps: () => vm.total_steps(),
    free: () => vm.free(),
  };
}
```

これにより、ステップ実行ループは1つの `runVmLoop(adapter, ...)` メソッドに統一できる。

### capabilities の更新

```typescript
static capabilities: ExecutionBackendCapabilities = {
  supportsInteractiveStdin: false,
  supportsCompile: true,
  supportsIgnoreDebug: true,   // ← false → true
  supportsLanguageSubsetForRun: false,
  requiresServer: false,
};
```

### 完了時の戻り値表示

`WasmNospaceVM` は `getReturnValue()` で実行結果の戻り値を返す。
完了時のシステムメッセージにこれを含める。

```typescript
// 完了時
const returnValue = vm.getReturnValue?.();
const returnMsg = returnValue !== undefined ? ` (return: ${returnValue})` : '';
this.outputCallback?.({
  type: 'system',
  data: `\n[WASM execution completed (${adapter.totalSteps()} steps)${returnMsg}]\n`,
  timestamp: Date.now(),
});
```

## エラーハンドリング

`WasmNospaceVM` のコンストラクタが例外をスローした場合は
既存の `handleWasmError()` メソッドで処理する。
`ResultErr` 型（`{ success: false, errors: [...] }`）の場合は構造化エラーとして
`compileErrorsCallback` に渡され、エディタアノテーションに反映される。

## VM のライフサイクル

- VM インスタンスは `this.vm` に保持し、`kill()` / `dispose()` 時に `free()` を呼ぶ。
- ステップ実行ループ完了後も `finally` ブロックで `free()` を呼ぶ。
- 現在のコードと同じパターンを踏襲する。
