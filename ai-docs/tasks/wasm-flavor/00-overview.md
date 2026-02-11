# WASM Flavor 設計概要

## 目的

nospace/whitespace の実行をブラウザ内の WASM で完結させる flavor を追加する。
サーバー(Socket.IO)不要で動作し、静的ホスティングのみで利用可能にする。

## 現状

- Server flavor（Socket.IO 経由で Node.js バックエンドの nospace20 プロセスを実行）は Phase 1〜8 で実装済み
- WASM バイナリおよび JS バインディングが `src/web/libs/nospace20/` に配置済み
  - `nospace20.js` — wasm-bindgen 生成の JS バインディング（**Node.js 向け**: `require('fs').readFileSync` を使用）
  - `nospace20_bg.wasm` — WASM バイナリ
  - `nospace20.d.ts` — TypeScript 型定義
  - `nospace20_bg.wasm.d.ts` — WASM exports 型定義

## WASM API 概要

### 一括実行関数

| 関数 | 説明 |
|------|------|
| `run(source, stdin, debug)` | nospace ソースを実行し結果を返す |
| `compile(source, target, lang_std)` | nospace ソースをコンパイル |
| `compile_to_mnemonic_string(source)` | ニーモニック出力 |
| `compile_to_whitespace_string(source)` | Whitespace 出力 |
| `parse(source)` | 構文チェックのみ |

### ステップ実行 VM (`WasmWhitespaceVM`)

| メソッド | 説明 |
|---------|------|
| `constructor(nospace_source, stdin)` | nospace ソースからVM構築 |
| `static fromWhitespace(ws_source, stdin)` | Whitespace ソースからVM構築 |
| `step(budget)` | 指定ステップ実行。戻り値: `{ status: "suspended" \| "complete" \| "error", error?: string }` |
| `flush_stdout()` | stdout バッファ取得＆クリア |
| `is_complete()` | 実行完了判定 |
| `pc()` | プログラムカウンタ |
| `total_steps()` | 総実行命令数 |
| `get_stack()` | データスタック取得 |
| `get_heap()` | ヒープ取得 |
| `get_traced()` | トレース情報取得 |
| `disassemble()` | 命令列ニーモニック取得 |
| `call_stack_depth()` | コールスタック深度 |
| `current_instruction()` | 現在の命令ニーモニック |
| `free()` / `[Symbol.dispose]()` | リソース解放 |

## 設計上の制約

### 1. stdin は事前供給のみ

`WasmWhitespaceVM` のコンストラクタで stdin を一括で渡す。実行中にインクリメンタルに stdin を供給する API は無い。

**対応**: WASM flavor では **batch モードのみサポート**。interactive モードは Server flavor 限定とする。

### 2. WASM JS バインディングが Node.js 向け

現在の `nospace20.js` は末尾で `require('fs').readFileSync` を使って WASM をロードしている。ブラウザでは動作しない。

**対応**: ブラウザ向けの WASM ローダーモジュールを作成する（詳細は [01-wasm-loader.md](01-wasm-loader.md)）。

### 3. メインスレッドブロック

WASM 実行はメインスレッドで行われるため、長時間実行するとUIがフリーズする。

**対応**: `step(budget)` を使い、一定ステップごとに `setTimeout` で制御を返すことで UI レスポンシブ性を維持する。

## アーキテクチャ

### 抽象化レイヤー

```
useNospaceExecution (hook)
        │
        ├── ExecutionBackend (interface)
        │       │
        │       ├── ServerExecutionBackend (Socket.IO)
        │       └── WasmExecutionBackend (WASM)
        │
        └── flavor 選択 (atom) に基づいて切り替え
```

実行バックエンドをインターフェースで抽象化し、`useNospaceExecution` hook をリファクタリングして
バックエンド実装に依存しないようにする。

### 新規ファイル

```
src/web/
├── libs/
│   └── nospace20/
│       ├── nospace20.js          # (既存) Node.js 向けバインディング
│       ├── nospace20.d.ts        # (既存) 型定義
│       ├── nospace20_bg.wasm     # (既存) WASM バイナリ
│       ├── nospace20_bg.wasm.d.ts # (既存) WASM exports 型定義
│       └── loader.ts             # (新規) ブラウザ向け WASM ローダー
├── services/
│   ├── ExecutionBackend.ts        # (新規) バックエンド抽象インターフェース
│   ├── ServerExecutionBackend.ts  # (新規) Server flavor 実装
│   └── WasmExecutionBackend.ts    # (新規) WASM flavor 実装
├── hooks/
│   ├── useNospaceExecution.ts     # (変更) バックエンド抽象化対応
│   └── useNospaceSocket.ts        # (既存・変更なし、Server flavor で利用)
└── stores/
    ├── flavorAtom.ts              # (新規) flavor 選択状態
    └── ...
```

### Vite 設定

`nospace20_bg.wasm` を Vite のアセットとして扱うための設定を追加。
`?url` サフィックスまたは `assetsInclude` 設定で WASM ファイルの URL を取得可能にする。

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [00-overview.md](00-overview.md) | 本ドキュメント（全体概要） |
| [01-wasm-loader.md](01-wasm-loader.md) | ブラウザ向け WASM ローダー設計 |
| [02-execution-backend.md](02-execution-backend.md) | ExecutionBackend 抽象化と実装 |
| [03-frontend-integration.md](03-frontend-integration.md) | フロントエンド統合・flavor 切り替え |

## 実装フェーズ

### Phase 9: ExecutionBackend 抽象化

- `ExecutionBackend` インターフェース定義
- `ServerExecutionBackend` 実装（既存 Socket.IO ロジックを移動）
- `useNospaceExecution` リファクタリング
- `flavorAtom` 追加
- **既存機能の動作に変更なし**（リファクタリングのみ）

### Phase 10: WASM ローダー + WasmExecutionBackend

- ブラウザ向け WASM ローダー作成
- `WasmExecutionBackend` 実装（step 実行、stdout ストリーミング）
- Vite 設定変更（WASM アセット対応）
- WASM flavor で compile / run が動作する状態

### Phase 11: Flavor 切り替え UI

- Header に flavor セレクター追加
- WASM flavor 時の UI 調整（interactive モード非表示など）
- flavor に応じたオプション制御

## 新規依存パッケージ

なし。WASM ロードは標準の `WebAssembly` API と `fetch` で行う。
