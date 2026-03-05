# UI / コンテナ / フックの変更設計

## 概要

WASM flavor で Run(Direct) タブを有効化し、`WasmNospaceVM` を使った
直接インタプリタ実行をトリガーできるようにする。

## 変更箇所

### 1. ExecutionContainer.tsx

#### 1-1. Run(Direct) タブの表示制御

**変更前**: `isWebSocket` の場合のみ Run(Direct) タブを表示
```tsx
{isWebSocket && (
  <button className={`mode-tab ${operationMode === 'run-direct' ? 'active' : ''}`}
    onClick={() => setOperationMode('run-direct')}>
    Run(Direct)
  </button>
)}
```

**変更後**: WebSocket / WASM いずれでも表示（条件ガード除去）
```tsx
<button className={`mode-tab ${operationMode === 'run-direct' ? 'active' : ''}`}
  onClick={() => setOperationMode('run-direct')}>
  Run(Direct)
</button>
```

#### 1-2. WASM リダイレクトの緩和

**変更前**: wasm + `run-direct` → `compile` へリダイレクト
```tsx
if (isWasm && (operationMode === 'run-direct' || operationMode === 'test-editor')) {
  setOperationMode('compile');
}
```

**変更後**: `run-direct` はリダイレクト対象外
```tsx
if (isWasm && operationMode === 'test-editor') {
  setOperationMode('compile');
}
```

#### 1-3. Run(Direct) パネルの InputPanel 制御

Run(Direct) モードでは WASM flavor でも `forceBatchMode` を維持する。
`WasmNospaceVM` は interactive モードに対応しないため。

```tsx
<InputPanelImpl
  isRunning={isRunning}
  onSendStdin={handleSendStdin}
  batchInput={batchInput}
  onBatchInputChange={setBatchInput}
  forceBatchMode={isWasm}  // 変更なし
/>
```

### 2. useNospaceExecution.ts

#### 2-1. handleRun の `direct` フラグ伝搬

Run(Direct) モードから呼ばれた場合に `RunOptions.direct = true` を設定する。

現在、`handleRun` は `ExecutionContainer` の `handleRunWithInput` 経由で呼ばれる。
`handleRun` は `operationMode` を直接参照していないため、`direct` フラグを引数で
受け取る方針とする。

**変更案A: handleRun に引数追加**

```typescript
const handleRun = useCallback(
  (stdinData?: string, options?: { direct?: boolean }) => {
    // ...
    backend.run(sourceCode, {
      // ...
      direct: options?.direct,
    }, stdinData);
  }, [...]
);
```

**変更案B: operationMode を atom から参照**

`handleRun` 内で `operationModeAtom` を参照し、`run-direct` の場合に
`direct: true` を自動設定する。

→ **案A を採用**: `handleRun` のインターフェースに明示的にオプションを追加する方が
   テスタビリティが高い。operationMode と実行ロジックの結合を避ける。

#### 2-2. ExecutionContainer → handleRunWithInput の修正

```tsx
const handleRunWithInput = () => {
  const inputMode = isWasm ? 'batch' : executionOptions.inputMode;
  handleRun(
    inputMode === 'batch' ? batchInput : undefined,
    operationMode === 'run-direct' ? { direct: true } : undefined,
  );
};
```

#### 2-3. Flavor 切り替え時のオプションリセット

現在は wasm 切り替え時に `ignoreDebug: false` にリセットしている。
`WasmNospaceVM` は `ignoreDebug` を対応しているため、
リセット対象から `ignoreDebug` を除外する。

**変更前**:
```typescript
if (flavor === 'wasm') {
  setExecutionOptions((prev) => ({
    ...prev,
    inputMode: 'batch',
    ignoreDebug: false,
  }));
}
```

**変更後**:
```typescript
if (flavor === 'wasm') {
  setExecutionOptions((prev) => ({
    ...prev,
    inputMode: 'batch',
  }));
}
```

### 3. NospaceTypes.ts

`RunOptions` に `direct` フラグを追加する。

```typescript
export interface RunOptions {
  // ... 既存フィールド
  /** WasmNospaceVM を使用した直接インタプリタ実行を行うか（WASM only） */
  direct?: boolean;
}
```

### 4. ExecutionOptions コンポーネント

Run(Direct) モードで `ignoreDebug` チェックボックスを表示する。
現在のコードで既に `ignoreDebug` の表示/非表示は capabilities ベースで判定されているか確認が必要。

→ capabilities に `supportsIgnoreDebug: true` を設定すれば
  既存のロジックで表示される見込み。別途確認する。

### 5. OperationMode 型

変更不要。既に `'run-direct'` が定義済み。
