# WASM 実行制限パラメータの UI 設定

## 概要

`WasmExecutionBackend` にハードコードされている `STEP_BUDGET`（1回の `vm.step()` で実行する命令数）と `MAX_TOTAL_STEPS`（無限ループ防止の最大総実行ステップ数）を、ユーザーが UI から変更できるようにする。

### 現状

| 定数 | デフォルト値 | 用途 |
|---|---|---|
| `STEP_BUDGET` | `10000` | `vm.step(STEP_BUDGET)` — 1回のステップ実行で処理する命令数。大きいほど高速だが UI スレッドをブロックする時間が長くなる |
| `MAX_TOTAL_STEPS` | `100_000_000` | `vm.total_steps() >= MAX_TOTAL_STEPS` で上限チェック — 無限ループ防止。超過時は `killed` ステータスで停止 |

これらは `src/web/services/WasmExecutionBackend.ts` の L16-L17 でファイルスコープ定数として定義され、変更手段がない。

## 要件

1. **UI から `STEP_BUDGET` と `MAX_TOTAL_STEPS` を設定可能にする**
   - WASM flavor でのみ表示（Server flavor には不要）
   - デフォルト値は現行と同じ（`STEP_BUDGET=10000`, `MAX_TOTAL_STEPS=100_000_000`）
   - 実行中の変更は次回実行時に反映される（実行中の変更は不要）

2. **妥当な入力制約を設ける**
   - `STEP_BUDGET`: 最小 100、最大 1,000,000（UI スレッドブロック防止）
   - `MAX_TOTAL_STEPS`: 最小 1,000、最大 10,000,000,000（10^10、メモリ制約考慮）
   - 不正値はデフォルト値にフォールバック

3. **UI の配置場所**
   - 既存の `ExecutionOptions` コンポーネント内に WASM 専用セクションとして追加
   - Execution mode / Compile mode の両方で同じ設定を共有

## 設計

### UI 配置場所の検討

#### 案 A: `ExecutionOptions` コンポーネント内に追加（**採用**）

既存の `ExecutionOptions` は flavor に応じてオプションの表示/非表示を切り替えるパターンが確立されている（`!isWasm` で Ignore debug / Input Mode を非表示）。WASM 専用オプションも同じパターンで `isWasm` 条件で表示すれば自然。

```
Execution Options
├── [✓] Debug trace (--debug)           ← 両 flavor
├── [ ] Ignore debug functions          ← WebSocket のみ
├── Input Mode: [Batch ▼]              ← WebSocket のみ
├── Step Budget: [10000      ]          ← WASM のみ (NEW)
└── Max Total Steps: [100000000 ]       ← WASM のみ (NEW)
```

**メリット**: 既存パターンに自然に統合。追加コンポーネント不要。一箇所で全実行オプションを管理。
**デメリット**: ExecutionOptions が肥大化する可能性。ただし現状のオプション数は少ないため問題ない。

#### 案 B: 別コンポーネント `WasmExecutionLimits` を新設

**不採用理由**: 現時点では項目が2つだけであり、別コンポーネントは過剰。将来オプションが増えた場合に分割を検討。

#### 案 C: 詳細設定パネル（アコーディオン/モーダル）

**不採用理由**: 発見性が低く、2つの設定値のためにモーダルやアコーディオンを作るのは過剰。

### データフロー

```
executionOptionsAtom (Jotai store)
    ↓ useAtomValue
ExecutionOptions.tsx (UI: number input)
    ↓ setOptions
executionOptionsAtom (更新)
    ↓ useAtomValue (useNospaceExecution hook)
handleRun() → RunOptions に含めて backend.run() に渡す
    ↓
WasmExecutionBackend.run() → runAsync() で使用
```

### 型定義の変更

#### `src/interfaces/NospaceTypes.ts`

`ExecutionOptions` に WASM 実行制限フィールドを追加:

```typescript
export interface ExecutionOptions {
  debug: boolean;
  ignoreDebug: boolean;
  inputMode: InputMode;
  /** WASM: 1回の vm.step() コールで実行する命令数 (default: 10000) */
  stepBudget: number;
  /** WASM: 最大総実行ステップ数 (default: 100_000_000) */
  maxTotalSteps: number;
}
```

**`RunOptions` への追加は不要とする理由**: `STEP_BUDGET`/`MAX_TOTAL_STEPS` は WASM バックエンドの内部実行制御パラメータであり、Server バックエンドの `RunOptions` プロトコルに含めるべきではない。`WasmExecutionBackend.run()` は `ExecutionOptions` の値を直接参照するか、`RunOptions` に含めて渡すかの2方式があるが、後者だとソケット通信のペイロードに不要なフィールドが含まれる。

**方式**: `RunOptions` にオプショナルフィールドとして追加する。Server バックエンドでは無視される。

```typescript
export interface RunOptions {
  language: LanguageSubset;
  debug: boolean;
  ignoreDebug: boolean;
  inputMode: InputMode;
  /** WASM only: 1回の vm.step() コールで実行する命令数 */
  stepBudget?: number;
  /** WASM only: 最大総実行ステップ数 */
  maxTotalSteps?: number;
}
```

### Store の変更

#### `src/web/stores/optionsAtom.ts`

`executionOptionsAtom` のデフォルト値に新フィールドを追加:

```typescript
export const executionOptionsAtom = atom<ExecutionOptions>({
  debug: false,
  ignoreDebug: false,
  inputMode: 'batch',
  stepBudget: 10000,
  maxTotalSteps: 100_000_000,
});
```

### UI コンポーネントの変更

#### `src/web/components/execution/ExecutionOptions.tsx`

WASM flavor の場合のみ、Step Budget と Max Total Steps の数値入力フィールドを表示:

```tsx
{/* Step Budget — WASM のみ */}
{isWasm && (
  <div className="option-group">
    <label>
      <span>Step Budget:</span>
      <input
        type="number"
        min={100}
        max={1000000}
        value={options.stepBudget}
        onChange={(e) =>
          setOptions({ ...options, stepBudget: Number(e.target.value) })
        }
      />
    </label>
  </div>
)}

{/* Max Total Steps — WASM のみ */}
{isWasm && (
  <div className="option-group">
    <label>
      <span>Max Total Steps:</span>
      <input
        type="number"
        min={1000}
        max={10000000000}
        value={options.maxTotalSteps}
        onChange={(e) =>
          setOptions({ ...options, maxTotalSteps: Number(e.target.value) })
        }
      />
    </label>
  </div>
)}
```

### Hook の変更

#### `src/web/hooks/useNospaceExecution.ts`

`handleRun` で `stepBudget` / `maxTotalSteps` を `RunOptions` に含める:

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
  },
  stdinData,
);
```

`handleRunCompileOutput` でも同様に渡す。

### Backend の変更

#### `src/web/services/WasmExecutionBackend.ts`

1. ファイルスコープ定数 `STEP_BUDGET`, `MAX_TOTAL_STEPS` をデフォルト値定数に変更:

```typescript
const DEFAULT_STEP_BUDGET = 10000;
const DEFAULT_MAX_TOTAL_STEPS = 100_000_000;
```

2. `run()` メソッドで `options` から値を取得:

```typescript
run(code: string, options: RunOptions, stdinData?: string): void {
  this.kill();
  const sessionId = crypto.randomUUID();
  this.abortController = new AbortController();
  const signal = this.abortController.signal;

  const stepBudget = options.stepBudget ?? DEFAULT_STEP_BUDGET;
  const maxTotalSteps = options.maxTotalSteps ?? DEFAULT_MAX_TOTAL_STEPS;

  this.runAsync(code, options, stdinData ?? '', sessionId, signal, stepBudget, maxTotalSteps);
}
```

3. `runAsync()` の引数に `stepBudget`, `maxTotalSteps` を追加し、ハードコード参照を置き換え。

### テストの変更

既存の `WasmExecutionBackend` テスト・`useNospaceExecution` テストにおいて `executionOptionsAtom` のデフォルト値に `stepBudget`/`maxTotalSteps` が含まれるよう更新。また、カスタム値を渡した場合のテストケースを追加。

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/interfaces/NospaceTypes.ts` | `ExecutionOptions` に `stepBudget`, `maxTotalSteps` 追加。`RunOptions` にオプショナルで追加 |
| `src/web/stores/optionsAtom.ts` | デフォルト値に新フィールド追加 |
| `src/web/components/execution/ExecutionOptions.tsx` | WASM 専用の数値入力 UI 追加 |
| `src/web/hooks/useNospaceExecution.ts` | `handleRun`, `handleRunCompileOutput` で新フィールドを渡す |
| `src/web/services/WasmExecutionBackend.ts` | 定数をデフォルト値に変更、`RunOptions` から値を取得 |
| `src/web/components/execution/styles/ExecutionOptions.scss` | 数値入力フィールドのスタイル（必要に応じて） |
| テストファイル（複数） | 型変更に伴う更新、新テストケース追加 |

## 進捗

- [ ] 型定義の変更 (`NospaceTypes.ts`)
- [ ] Store の変更 (`optionsAtom.ts`)
- [ ] UI コンポーネントの変更 (`ExecutionOptions.tsx`)
- [ ] Hook の変更 (`useNospaceExecution.ts`)
- [ ] Backend の変更 (`WasmExecutionBackend.ts`)
- [ ] スタイルの調整
- [ ] テストの更新・追加
- [ ] ビルド・全テスト合格
