# テスト編集機能 設計概要

## 目的

nospace 言語のテストケース（`.ns` ソースファイル + `.check.json` 期待結果ファイル）を Web UI 上で閲覧・編集・追加できる機能を追加する。
`APPLICATION_FLAVOR=websocket` 環境でのみ利用可能な、サーバーサイドファイル操作を前提としたモード。

## 背景

### 現状

- テストケースは `.local/tests/` ディレクトリ配下にファイルとして配置されている
- テストの閲覧・編集はエディタ（VS Code 等）で直接行う必要がある
- Web UI にはテスト管理機能が存在しない

### テストファイル構造

```
.local/tests/
├── passes/                    # 正常終了するテストケース
│   ├── builtins/
│   ├── control_flow/
│   ├── examples/
│   ├── functions/
│   ├── integration/
│   ├── io/
│   ├── literals/
│   ├── main_idx/
│   ├── operators/
│   ├── scope/
│   ├── variables/
│   ├── c000.ns
│   └── c000.check.json
└── fails/                     # エラーになるべきテストケース
    ├── compile/
    └── syntax/
```

各テストケースは以下のペアで構成される：

1. **ソースファイル** (`*.ns`): nospace ソースコード
2. **期待結果ファイル** (`*.check.json`): 実行結果の検証条件

### check.json のスキーマバリエーション

```jsonc
// 1. 成功（trace ベース検証）
{ "trace_hit_counts": [1] }

// 2. 成功（trace ベース検証、type 明示）
{ "type": "success", "trace_hit_counts": [1, 1, 1] }

// 3. 成功（IO ベース検証 - 単一ケース）
{ "type": "success_io", "stdin": "ABC", "stdout": "ABC" }

// 4. 成功（IO ベース検証 - 複数ケース）
{
  "type": "success_io",
  "cases": [
    { "name": "positive", "stdin": "42\n", "stdout": "42" },
    { "name": "zero", "stdin": "0\n", "stdout": "0" }
  ]
}

// 5. コンパイルエラー検証
{ "type": "compile_error", "contains": ["error message substring"] }

// 6. パースエラー検証
{ "type": "parse_error", "phase": "tree" }
{ "type": "parse_error", "phase": "tokenize", "contains": ["error detail"] }
```

## 機能要件

### 1. テストディレクトリの ENV 設定

- 環境変数 `NOSPACE_TEST_DIR` でテストディレクトリパスを設定可能にする
- デフォルト値: `./resources/tests`（`.local/tests` は開発者個人環境のためデフォルトにしない）
- サーバーサイド `Config.ts` に追加

### 2. モード切り替え UI

- 右ペイン（`ExecutionContainer`）に「Execution」「Test Editor」のモード切り替えタブを追加
- `APPLICATION_FLAVOR=websocket` の場合のみ「Test Editor」タブを表示
- 既存の Execution / Compile モードとは排他的な第3のモード

### 3. テスト一覧表示

- テストディレクトリ内のファイルをツリー形式で一覧表示
- ディレクトリ（カテゴリ）ごとに折りたたみ可能
- 各テストケースは `.ns` ファイル名をベースに表示（`.check.json` は暗黙的にペア）
- テストケースの選択で詳細（エディタ）を開く

### 4. テストケース編集

- 選択したテストケースのソースコード（`.ns`）をエディタに表示・編集
- 期待結果（`.check.json`）を構造化フォームまたは JSON エディタで編集
- 保存ボタンでサーバーにファイル書き込み

### 5. テストケース新規追加

- テストケースの新規作成 UI
- カテゴリ（ディレクトリ）の選択
- ファイル名の入力
- ソースコードと期待結果の入力
- 作成ボタンでサーバーにファイル作成

## 非機能要件

- WebSocket flavor でのみ利用可能（WASM flavor では非表示）
- サーバーとの通信は REST API を新設する（Socket.IO はリアルタイム実行用途に限定）
- テストの「実行」機能は本タスクのスコープ外（将来拡張として検討）

## アーキテクチャ概要

```
[Frontend]                                    [Backend]
                                              
IndexPage                                     Express Server
└── SplitPane                                  ├── REST API Routes (新設)
    ├── EditorContainer                        │   ├── GET  /api/tests          (一覧取得)
    └── ExecutionContainer                     │   ├── GET  /api/tests/:path    (ファイル取得)
        ├── [Execution mode] (既存)             │   ├── PUT  /api/tests/:path    (ファイル更新)
        ├── [Compile mode]   (既存)             │   └── POST /api/tests          (ファイル作成)
        └── [Test Editor mode] (新設)           └── TestController (新設)
            ├── TestListPanel                        └── TestFileService (新設)
            ├── TestEditorPanel                           └── fs 操作
            └── TestCheckEditor
```

## モジュール分割

本タスクは以下のモジュールに分割して実装する：

| # | ドキュメント | 内容 |
|---|------------|------|
| 1 | [01-server-api.md](01-server-api.md) | サーバーサイド REST API・サービス・設定 |
| 2 | [02-test-list-panel.md](02-test-list-panel.md) | テスト一覧パネル（フロントエンド） |
| 3 | [03-test-editor-panel.md](03-test-editor-panel.md) | テスト編集パネル（フロントエンド） |
| 4 | [04-mode-switching.md](04-mode-switching.md) | モード切り替え・統合 |
