# nospace Web UI 設計概要

## 目的

nospace 言語のコードを編集・コンパイル・実行できるシングルページ Web アプリケーション。

## 全体構成

### レイアウト

```
+--------------------------------------------------------------+
|  ヘッダー (タイトル・設定)                                      |
+-------------------------------+------------------------------+
|                               |                              |
|   コードエディタ (Ace)          |   実行パネル                  |
|                               |   ┌────────────────────────┐ |
|                               |   │ コンパイルオプション      │ |
|                               |   │ 実行オプション            │ |
|                               |   │ [Compile] [Run] [Stop]  │ |
|                               |   ├────────────────────────┤ |
|                               |   │ 標準出力                 │ |
|                               |   ├────────────────────────┤ |
|                               |   │ 標準入力                 │ |
|                               |   └────────────────────────┘ |
+-------------------------------+------------------------------+
```

- 左右 2 ペイン構成（リサイズ可能）
- 左: Ace Editor（nospace syntax highlighting 付き）
- 右: 実行パネル（オプション・出力・入力）

### 2 つの Flavor

| Flavor | 概要 | 状態 |
|--------|------|------|
| **Server** | Node.js から外部プロセス（nospace20）を実行。Socket.IO で通信 | 今回実装する |
| **WASM** | ブラウザ内で wasm により完結。サーバー不要 | 将来実装（今回はスキップ） |

クライアント側は Flavor を切り替え可能な抽象層を設ける（詳細は [01-frontend-layout.md](01-frontend-layout.md)）。

### 技術スタック（既存踏襲）

- フロントエンド: React 18 + TypeScript + Vite
- 状態管理: Jotai
- バックエンド: Node.js + Express + Socket.IO
- スタイル: SCSS
- エディタ: Ace Editor（新規追加）

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [00-overview.md](00-overview.md) | 本ドキュメント（全体概要） |
| [01-frontend-layout.md](01-frontend-layout.md) | フロントエンド構成・コンポーネント設計 |
| [02-ace-editor.md](02-ace-editor.md) | Ace Editor 統合と nospace syntax highlighting |
| [03-server-execution.md](03-server-execution.md) | サーバーサイド実行サービス設計 |
| [04-socketio-protocol.md](04-socketio-protocol.md) | Socket.IO 通信プロトコル |
| [05-env-config.md](05-env-config.md) | 環境設定・.env 設計 |
| [06-io-interaction.md](06-io-interaction.md) | 標準入出力のインタラクションモード |

## ディレクトリ構成（最終形）

```
src/
├── app/
│   ├── Config.ts                    # 環境設定（.env 読み込み）
│   ├── MainServer.ts                # エントリポイント
│   ├── Controllers/
│   │   └── NospaceController.ts     # Socket.IO イベントハンドラ
│   ├── Services/
│   │   └── NospaceExecutionService.ts  # 外部プロセス実行
│   ├── Web/
│   │   ├── Express.ts
│   │   ├── ExpressSocketIO.ts       # Socket.IO イベント登録
│   │   ├── ExpressStatic.ts
│   │   └── ExpressViteDev.ts
│   └── Routes/                      # （REST API が必要なら）
├── interfaces/
│   └── NospaceTypes.ts              # 共通型定義
├── lib/                             # 共通ライブラリ
└── web/
    ├── components/
    │   ├── editor/
    │   │   └── NospaceEditor.tsx     # Ace Editor ラッパー
    │   ├── execution/
    │   │   ├── CompileOptions.tsx    # コンパイルオプション UI
    │   │   ├── ExecutionOptions.tsx  # 実行オプション UI
    │   │   ├── ExecutionControls.tsx # ボタン群
    │   │   ├── OutputPanel.tsx       # 標準出力表示
    │   │   └── InputPanel.tsx        # 標準入力
    │   └── layout/
    │       ├── SplitPane.tsx         # リサイズ可能 2 ペイン
    │       └── Header.tsx
    ├── containers/
    │   ├── EditorContainer.tsx       # エディタ状態管理
    │   └── ExecutionContainer.tsx    # 実行パネル状態管理
    ├── hooks/
    │   ├── useNospaceExecution.ts    # 実行制御フック
    │   └── useNospaceSocket.ts      # Socket.IO 通信フック
    ├── pages/
    │   └── index.tsx                 # メインページ
    ├── services/
    │   ├── ExecutionBackend.ts       # Flavor 抽象インターフェース
    │   └── ServerExecutionBackend.ts # Server flavor 実装
    ├── stores/
    │   ├── editorAtom.ts             # エディタ状態
    │   ├── executionAtom.ts          # 実行状態
    │   ├── optionsAtom.ts            # オプション状態
    │   └── socketAtom.ts             # Socket.IO 接続状態
    └── styles/
```

## 新規依存パッケージ

| パッケージ | 用途 |
|-----------|------|
| `ace-builds` | Ace Editor 本体 |
| `react-ace` | React 向け Ace Editor ラッパー |
| `dotenv` | サーバー側 .env ファイル読み込み |

## 実装順序（推奨）

1. 環境設定（.env / Config）
2. サーバーサイド実行サービス + Socket.IO プロトコル
3. フロントエンドレイアウト（SplitPane）
4. Ace Editor 統合（syntax highlighting）
5. 実行パネル UI（オプション・ボタン・出力）
6. 標準入出力のインタラクション
7. サンプルコード（Counter の削除も含む）
