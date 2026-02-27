# 02: ExecutionContainer タブ UI・条件分岐の変更

## 対象ファイル

- `src/web/containers/ExecutionContainer.tsx`
- `src/web/containers/styles/ExecutionContainer.scss`（変更不要の見込み）

## 現状

```
タブ: [Execution] [Compile] [Test Editor]
```

- `Execution` = `operationMode === 'execution'`
- `Compile` = `operationMode === 'compile'`
- `Test Editor` = `operationMode === 'test-editor'`（WebSocket のみ）

WASM では全タブが表示される（Test Editor はフィルタされているが Compile / Execution は常に表示）。

## 変更後

```
タブ: [Compile] [Run] [Run(Direct)] [TestEditor]
```

### タブ表示条件

| タブ | 表示条件 |
|---|---|
| Compile | 常に表示 |
| Run | 常に表示 |
| Run(Direct) | `isWebSocket`（WebSocket flavor のみ） |
| TestEditor | `isWebSocket`（WebSocket flavor のみ） |

### 条件分岐レンダリング

```tsx
{operationMode === 'test-editor' ? (
  <TestEditorContainer />
) : operationMode === 'compile' ? (
  // Compile タブ: コンパイルのみ
  <>
    <CompileOptions />
    <ExecutionControls isRunning={isRunning} onCompile={handleCompile} onKill={handleKill} />
    <CompileOutputPanel ... />
    <OutputPanel onClear={handleClearOutput} />   {/* エラー出力表示用 */}
  </>
) : operationMode === 'run' ? (
  // Run タブ: コンパイル済みコードの実行
  // → 03-run-tab-panel.md で詳細設計
  <>
    <ExecutionOptions />
    <ExecutionControls isRunning={isRunning} onRun={handleRunCompiled} onKill={handleKill} />
    <OutputPanel onClear={handleClearOutput} />
    <InputPanel
      isRunning={isRunning}
      onSendStdin={handleSendStdin}
      batchInput={batchInput}
      onBatchInputChange={setBatchInput}
      forceBatchMode={true}
    />
  </>
) : (
  // Run(Direct) タブ: 従来の Execution モード
  <>
    <ExecutionOptions />
    <ExecutionControls isRunning={isRunning} onRun={handleRunWithInput} onKill={handleKill} />
    <OutputPanel onClear={handleClearOutput} />
    <InputPanel
      isRunning={isRunning}
      onSendStdin={handleSendStdin}
      batchInput={batchInput}
      onBatchInputChange={setBatchInput}
      forceBatchMode={isWasm}
    />
  </>
)}
```

### useEffect の変更

Flavor 切り替え時に非対応タブからの強制リダイレクトロジックを更新:

```typescript
useEffect(() => {
  // WASM flavor は run-direct / test-editor 非対応
  if (isWasm && (operationMode === 'run-direct' || operationMode === 'test-editor')) {
    setOperationMode('compile');
  }
  // WebSocket flavor は全タブ対応（追加フィルタ不要）
}, [isWasm, operationMode]);
```

### Compile タブからの変更点

現在の Compile タブから以下を **除去**:
- `ExecutionOptions` — 実行オプションは Run タブに移動
- `InputPanel` — バッチ入力は Run タブに移動

現在の Compile タブの `CompileOutputPanel` 内の「Run」ボタンは **除去**（代わりに Run タブへ誘導）。

### 不要になるコード

- `CompileOutputPanel` の `onRunCompiled` prop と Run ボタン — Run タブに分離したため不要
  - ただし、`CompileOutputPanel` は Compile タブでのコンパイル結果表示としてそのまま使用
  - `onRunCompiled` prop をオプショナルにし、未指定時は Run ボタン非表示

## テスト観点

- WASM flavor で "Compile" と "Run" タブのみ表示されること
- WebSocket flavor で 4 タブ全て表示されること
- WASM で "Run(Direct)" / "TestEditor" タブに切り替え不可（useEffect で強制リダイレクト）
- 各タブで適切なコンポーネントがレンダリングされること
