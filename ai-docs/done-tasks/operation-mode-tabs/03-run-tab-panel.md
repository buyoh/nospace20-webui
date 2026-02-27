# 03: Run タブのパネル構成

## 概要

新設する "Run" タブは、Compile タブで生成されたコンパイル済みコード（`compileOutputAtom`）を
入力として受け取り実行する。

## 対象ファイル

- `src/web/containers/ExecutionContainer.tsx`（Run タブ部分の追加）

## データフロー

```
[Compile タブ]
  ↓ handleCompile()
  ↓ compileOutputAtom に結果を格納
  ↓
[Run タブ]
  ↓ compileOutputAtom から読み取り
  ↓ handleRunCompileOutput(compiledCode, stdinData)
  ↓ OutputPanel に実行結果を表示
```

`compileOutputAtom` (`src/web/stores/compileOutputAtom.ts`) に格納される `CompileOutput`:
```typescript
interface CompileOutput {
  output: string;        // コンパイル結果テキスト
  target: CompileTarget; // コンパイルターゲット（'ws' | 'mnemonic' | ...）
}
```

## Run タブの UI 構成

### 1. コンパイル結果ステータス表示

Run タブに切り替えた際、コンパイル結果がない / 実行不可能なターゲットの場合に
メッセージを表示する。

- `compileOutput === null` → 「コンパイル結果がありません。Compile タブでコンパイルしてください。」
- `compileOutput.target !== 'ws'` → 「ターゲット '{target}' は実行できません。ターゲットを 'ws' に変更してコンパイルし直してください。」
- `compileOutput.target === 'ws'` → 実行可能。Run ボタン有効。

### 2. パネル構成

```
┌──────────────────────────────────┐
│ [コンパイル結果ステータス]        │
│ ExecutionOptions                 │
│ ExecutionControls [Run] [Stop]   │
│ OutputPanel                      │
│ InputPanel (batch mode)          │
└──────────────────────────────────┘
```

- **ExecutionOptions**: debug / step budget / max total steps のオプション
  - 現在の ExecutionOptions コンポーネントをそのまま使用
  - Run タブでは `inputMode` は常に `batch`（コンパイル済み WS コードを実行するため）
  - `ignoreDebug` は非表示（WS 実行時は不要）
- **ExecutionControls**: `onRun` に `handleRunCompiled` を接続
  - `compileOutput === null || compileOutput.target !== 'ws'` の場合、Run ボタンを disabled
- **OutputPanel**: 実行結果の stdout/stderr 表示
- **InputPanel**: バッチ入力。`forceBatchMode={true}` 固定

### 3. handleRunCompiled の修正

現在の `handleRunCompiled` は `compileOutput?.target === 'ws'` の場合のみ動作するが、
これをそのまま使用する。Run タブ側で実行可否チェックを UI レベルで行い、
ボタン disabled 制御する。

```typescript
const handleRunCompiled = () => {
  if (compileOutput?.target === 'ws') {
    handleRunCompileOutput(compileOutput.output, batchInput);
  }
};
```

## CompileOutputPanel の変更

Run タブ分離に伴い、`CompileOutputPanel` 内の Run ボタンは不要になる。

### 変更案

`onRunCompiled` prop をオプショナルにする:

```typescript
interface CompileOutputPanelProps {
  compileOutput: CompileOutput | null;
  onRunCompiled?: () => void;  // optional に変更
  isRunning: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

- `onRunCompiled` 未指定時: headerActions の Run ボタンを非表示
- Compile タブから呼び出す際は `onRunCompiled` を省略

## テスト観点

- `compileOutput` が null の場合、Run ボタンが disabled であること
- `compileOutput.target !== 'ws'` の場合、Run ボタンが disabled であること
- `compileOutput.target === 'ws'` の場合、Run ボタンが有効であること
- Run ボタン押下時に `handleRunCompileOutput` が正しい引数で呼ばれること
- batchInput が正しく渡されること
- Compile タブの CompileOutputPanel に Run ボタンが表示されないこと
