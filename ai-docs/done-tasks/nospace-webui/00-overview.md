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
|   コードエディタ               |   実行パネル                  |
|   (初期: textarea)            |   ┌────────────────────────┐ |
|   (後期: Ace Editor)          |   │ コンパイルオプション      │ |
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
- 左: エディタ（初期は `<textarea>`、後に Ace Editor へ差し替え）
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
- エディタ: 初期は `<textarea>`、後に Ace Editor に移行

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
    │   │   ├── CodeTextarea.tsx      # textarea ベースのエディタ（初期実装）
    │   │   └── NospaceEditor.tsx     # Ace Editor ラッパー（Phase 8）
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

## 実装フェーズ

以下の方針で段階的に実装する:
- **動くものを最速で作る**ことを優先
- 初期フェーズでは **新規パッケージを追加しない**（既存依存のみ）
- Ace Editor は後フェーズで導入（初期は `<textarea>` で代用）

### Phase 1: 環境設定 + 共通型定義

- `Config.ts` に nospace 設定を追加（`process.env` から直接読み取り、`dotenv` は後で導入）
- `.env.example` を作成（ドキュメント目的）
- `NospaceTypes.ts` を作成（共通型・Socket.IO イベント型）
- **新規依存: なし**

### Phase 2: サーバーサイド実行サービス

- `NospaceExecutionService.ts` 作成
- `child_process.spawn` で nospace20 を実行
- 一時ファイルの作成・削除（`./tmp/` ディレクトリ）
- セッション管理・タイムアウト制御
- **新規依存: なし**（Node.js 標準モジュールのみ）

### Phase 3: Socket.IO プロトコル拡張

- `NospaceController.ts` 作成
- `ExpressSocketIO.ts` を拡張（Counter と共存させる）
- `MainServer.ts` を拡張
- **新規依存: なし**（既存の socket.io を使用）

### Phase 4: フロントエンド基本構成

- ページレイアウト作成（`SplitPane`, `Header`）— CSS Flexbox で自前実装
- `CodeTextarea.tsx`（`<textarea>` ベースのシンプルなエディタ）
- `EditorContainer.tsx`
- Jotai atoms（`editorAtom`, `optionsAtom`, `executionAtom`）
- **新規依存: なし**

### Phase 5: 実行パネル UI + 通信接続

- `ExecutionControls`, `CompileOptions`, `ExecutionOptions`
- `OutputPanel`（基本的な stdout/stderr 表示）
- `ExecutionContainer.tsx`
- `ServerExecutionBackend.ts`（Socket.IO クライアント通信）
- `useNospaceExecution`, `useNospaceSocket` フック
- **End-to-end で動作する最小構成の完成**
- **新規依存: なし**

### Phase 6: 標準入出力のインタラクション

- `InputPanel`（batch / interactive モード切り替え）
- stdin エコー表示
- 出力パネルの自動スクロール
- **新規依存: なし**

### Phase 7: dotenv 導入・Counter 削除・クリーンアップ

- `dotenv` パッケージを導入し `.env.local` 対応
- Counter 関連コード削除
- コード整理・リファクタリング
- **新規依存: `dotenv`**

### Phase 8: Ace Editor 統合

- tmLanguage → Ace Mode 変換ツールのセットアップ
- `NospaceEditor.tsx`（Ace Editor ラッパー）
- `CodeTextarea` → `NospaceEditor` に差し替え
- **新規依存: `ace-builds`, `react-ace`**
- **✅ 完了（2026/02/11）**

## 新規依存パッケージ（全フェーズ合計）

| パッケージ | 用途 | 導入フェーズ |
|-----------|------|-------------|
| `dotenv` | サーバー側 .env ファイル読み込み | Phase 7 |
| `ace-builds` | Ace Editor 本体 | Phase 8 |
| `react-ace` | React 向け Ace Editor ラッパー | Phase 8 |

Phase 1〜6 の間は **新規パッケージの追加なし**。

## 実装完了報告

- [nospace-webui-phase7-8-implementation.md](../../done-tasks/nospace-webui-phase7-8-implementation.md) 実装完了報告（2026/02/11）

**全フェーズ（Phase 1〜8）実装完了。nospace Web UI は動作可能な状態。**
