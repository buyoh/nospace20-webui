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
