# オペレーションモード タブ再構成

## 概要

現在の "Execution" / "Compile" / "Test Editor" の3タブ構成を、
**"Compile" / "Run" / "Run(Direct)" / "TestEditor"** の4タブ構成に変更する。

WASM flavor は直接実行をサポートしていない（内部的に「Execution」は「コンパイル→実行」）ため、
明示的に「コンパイル」と「コンパイル結果の実行」を分離する。

## 背景

- WASM の `run()` は内部的に nospace コードを Whitespace にコンパイルして VM 実行している
- 現在の UI はこれを "Execution" として一括表示しているが、実態と合っていない
- コンパイル結果を確認してから実行したいユースケースに対応するため、タブを分離する

## タブ構成

| タブ名 | WASM | WebSocket | 説明 |
|---|---|---|---|
| **Compile** | ✅ | ✅ | ソースコードをコンパイルのみ行い、中間出力を表示 |
| **Run** | ✅ | ✅ | Compile タブでコンパイル済みの結果を実行 |
| **Run(Direct)** | ❌ | ✅ | ソースコードを直接実行（従来の Execution モード相当） |
| **TestEditor** | ❌ | ✅ | テストケース編集（従来と同じ） |

## 設計ドキュメント

- [01-operation-mode-type.md](01-operation-mode-type.md) — OperationMode 型・atom・デフォルト値の変更
- [02-execution-container.md](02-execution-container.md) — ExecutionContainer タブ UI・条件分岐の変更
- [03-run-tab-panel.md](03-run-tab-panel.md) — Run タブのパネル構成（コンパイル済みコードの実行 UI）

## 実装状況

### ✅ 完了（2026-02-27）

#### 変更ファイル

- `src/web/stores/testEditorAtom.ts`
  - `OperationMode` 型を `'execution' | 'compile' | 'test-editor'` から `'compile' | 'run' | 'run-direct' | 'test-editor'` に変更
  - デフォルト値を `'execution'` から `'compile'` に変更

- `src/web/containers/ExecutionContainer.tsx`
  - 4タブ構成（Compile / Run / Run(Direct) / TestEditor）に変更
  - WASM flavor では run-direct / test-editor を非表示・リダイレクト
  - Compile タブから ExecutionOptions / InputPanel を除去
  - Run タブを新設（compileOutput を基に実行）
  - `backendFactory` prop を追加（依存性注入・テスト用）

- `src/web/components/execution/CompileOutputPanel.tsx`
  - `onRunCompiled` prop をオプショナルに変更（未指定時は Run ボタン非表示）

- `src/web/components/execution/ExecutionControls.tsx`
  - `runDisabled` prop を追加（Run ボタンを追加で disabled 制御）

#### 追加テストファイル

- `src/tests/web/testEditorAtom.spec.ts` — operationModeAtom 初期値・型テスト
- `src/tests/web/ExecutionContainer.spec.tsx` — タブ構成・Run ボタン disabled 制御テスト

#### 追加テストケース（既存ファイル）

- `src/tests/web/ExecutionControls.spec.tsx` — `runDisabled` prop テスト追加
- `src/tests/web/CompileOutputPanel.spec.tsx` — `onRunCompiled` 未指定時の Run ボタン非表示テスト追加

#### テスト結果

- 全 31 テストスイート・415 テスト PASS
