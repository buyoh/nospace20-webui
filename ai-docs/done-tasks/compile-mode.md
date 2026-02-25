# Compile Mode / Execution Mode 切り替え

## 概要

Execution mode（従来の実行機能）と Compile mode（コンパイル + 中間出力）を切り替えられるようにする。

## 要件

1. **Execution mode**: 従来の実行機能（変更なし）
2. **Compile mode**:
   - コンパイル結果を「中間出力パネル」(CompileOutputPanel) に表示
   - 中間出力のターゲットが Whitespace の場合、パネル内の Run ボタンで実行し、結果を Output に表示
   - 中間出力パネルは折りたたみ可能（画面幅対応）

## 設計

### OperationMode

- `'execution' | 'compile'` — ExecutionContainer のローカル state
- Server flavor では常に `'execution'`（Compile 非対応）
- WASM flavor ではタブで切り替え可能

### Store

- `compileOutputAtom`: コンパイル中間出力を保持
  - `{ output: string, target: CompileTarget } | null`

### UI レイアウト

**Execution mode:**
```
[Execution] [Compile]    ← モード切り替えタブ(WASM のみ)
ExecutionOptions
[Run] [Stop]
OutputPanel
InputPanel
```

**Compile mode:**
```
[Execution] [Compile]    ← モード切り替えタブ
CompileOptions
[Compile] [Stop]
CompileOutputPanel       ← 折りたたみ可能、ws ターゲット時に [Run] ボタン
OutputPanel              ← コンパイル結果実行時の出力
InputPanel               ← batch 入力（実行時の stdin）
```

### Hook の変更 (useNospaceExecution)

- `compileTargetRef` でコンパイル中の出力ルーティングを制御
- コンパイル時: stdout → `compileOutputAtom`、stderr/system → `outputEntriesAtom`
- 実行時: 全て → `outputEntriesAtom`
- `handleRunCompileOutput(code, stdinData?)` を追加

### コンポーネント変更

- `ExecutionControls`: `onRun`, `onCompile` を両方 optional に（モードに応じて渡す/渡さない）
- `CompileOutputPanel`: 新規。折りたたみ可能、ws ターゲット時に Run ボタン
- `ExecutionContainer`: モード切り替えタブ + conditional rendering

## 進捗

- [x] compileOutputAtom 作成
- [x] useNospaceExecution 更新
- [x] CompileOutputPanel 作成
- [x] ExecutionControls 更新
- [x] ExecutionContainer 更新
- [x] テスト追加（CompileOutputPanel, ExecutionControls, useNospaceExecution）
- [x] ビルド・全テスト合格（12 suites, 155 tests）
