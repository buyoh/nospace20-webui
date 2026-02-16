# コンパイル出力ビューア 設計概要

## 目的

nospace のコンパイル結果（中間言語・Whitespace コード）を閲覧しやすい形で表示する機能を追加する。
特に Whitespace 出力（スペース・タブ・改行のみ）は視認不可能なため、可視文字への変換表示を提供する。

## 背景

### 現状の課題

- コンパイル出力は `OutputPanel` に `stdout` エントリとして表示される
- `ws` ターゲットの出力はスペース (`\x20`)・タブ (`\t`)・改行 (`\n`) のみで構成されるため、画面上では空白に見える
- 大量の出力（数千〜数万行）に対するページネーションがない
- コンパイル結果専用の表示領域がなく、実行結果と混在する

### コンパイルターゲット一覧

| ターゲット | 出力形式 | 可視性 |
|-----------|---------|--------|
| `ws` | Whitespace ソースコード（SP/TB/LF の 3 文字のみ） | **不可視** |
| `mnemonic` | ニーモニック表現 (`push 1`, `add` 等) | 可視 |
| `ex-ws` | 拡張 Whitespace | 部分的に可視 |
| `json` | JSON 形式の命令列 | 可視 |

## 機能要件

### 1. Whitespace 表示モード切り替え

Whitespace 出力に対して以下の表示モードを切り替え可能にする:

| モード | 表示例 | 用途 |
|--------|-------|------|
| **通常** | そのまま表示（不可視文字はそのまま） | コピペ用 |
| **可視文字** | `SP` `TB` `LF` に置換して表示 | 内容確認用 |

- 切り替えはトグルボタンまたはセレクターで即座に反映
- `ws` / `ex-ws` ターゲットの出力時にのみ表示モード切り替え UI を表示
- `mnemonic` / `json` ターゲットではテキストがそのまま可読なため不要

### 2. ページネーション

コンパイル結果が大量の場合に、描画パフォーマンスを維持するためページネーションを提供する。

- 出力を行単位で分割
- 1 ページあたりの表示行数: デフォルト 100 行
- ページ移動: 前へ / 次へ / 先頭 / 末尾
- 現在ページ / 全ページ数の表示
- 出力が 1 ページに収まる場合はページネーション UI を非表示

### 3. コンパイル出力専用パネル

実行時の OutputPanel とは別に、コンパイル結果を独立して表示する。

- コンパイル結果は専用の Jotai atom に保存
- OutputPanel の `stdout` / `stderr` エントリとは混在させない
- コンパイルエラーはエラー表示として同パネル内に表示

## 前提条件（依存タスク）

- **Phase 11（未完了）**: Compile ボタン・CompileOptions コンポーネントの追加が前提
  - ただし本機能はコンパイルUI（Phase 11）と同時並行で実装可能

## 全体アーキテクチャ

```
User clicks Compile
    │
    ▼
useNospaceExecution.handleCompile()
    │
    ├── outputEntries はクリア（実行出力用）
    │
    ▼
WasmExecutionBackend.compile(code, options)
    │
    ├── success → onCompileOutput コールバック（新規追加）
    │                   │
    │                   ▼
    │             compileResultAtom に格納（新規）
    │                   │
    │                   ▼
    │             CompileOutputPanel が描画
    │                   ├── ページネーション
    │                   └── 表示モード切り替え
    │
    └── error → outputCallback (既存: stderr として表示)
```

## コンポーネント構成

```
ExecutionContainer
├── ExecutionOptions
├── CompileOptions          ← Phase 11 で追加
├── ExecutionControls       ← Phase 11 で Compile ボタン追加
├── CompileOutputPanel      ← 【新規】コンパイル結果専用パネル
│   ├── DisplayModeToggle   ← 【新規】通常/可視文字切り替え
│   └── Pagination          ← 【新規】ページ送り
├── OutputPanel             ← 既存（実行結果用）
└── InputPanel
```

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [00-overview.md](00-overview.md) | 本ドキュメント（全体概要） |
| [01-compile-output-store.md](01-compile-output-store.md) | コンパイル結果のデータモデル・atom 設計 |
| [02-compile-output-panel.md](02-compile-output-panel.md) | CompileOutputPanel コンポーネント設計（表示モード・ページネーション） |

## 新規ファイル

```
src/
├── interfaces/
│   └── NospaceTypes.ts              # CompileResult 型追加
└── web/
    ├── components/
    │   └── execution/
    │       ├── CompileOutputPanel.tsx       # 【新規】コンパイル出力パネル
    │       └── styles/
    │           └── CompileOutputPanel.scss  # 【新規】スタイル
    ├── stores/
    │   └── compileResultAtom.ts            # 【新規】コンパイル結果 atom
    ├── hooks/
    │   └── useNospaceExecution.ts          # 【変更】compile 結果を専用 atom へ
    └── libs/
        └── whitespaceFormatter.ts          # 【新規】Whitespace 可視化ユーティリティ
```

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/interfaces/NospaceTypes.ts` | `CompileResult` 型を追加 |
| `src/web/services/ExecutionBackend.ts` | `onCompileOutput` コールバックを追加 |
| `src/web/services/WasmExecutionBackend.ts` | compile 結果を `onCompileOutput` 経由で通知 |
| `src/web/hooks/useNospaceExecution.ts` | compile 結果を `compileResultAtom` に格納 |
| `src/web/containers/ExecutionContainer.tsx` | `CompileOutputPanel` を配置 |

## 実装フェーズ

### ステップ 1: データモデル・atom の追加

- `CompileResult` 型定義
- `compileResultAtom`、`whitespaceDisplayModeAtom` 追加
- `ExecutionBackend` に `onCompileOutput` コールバック追加

### ステップ 2: Whitespace 可視化ユーティリティ

- `whitespaceFormatter.ts` 実装
- SP/TB/LF 変換ロジック

### ステップ 3: CompileOutputPanel コンポーネント

- コンパイル結果の表示
- 表示モードトグル
- ページネーション
- SCSS スタイル

### ステップ 4: バックエンド・フック統合

- `WasmExecutionBackend.compile()` から `onCompileOutput` を呼び出す
- `useNospaceExecution` で compile 結果を atom にセット
- `ExecutionContainer` に `CompileOutputPanel` を配置

## 新規依存パッケージ

なし。
