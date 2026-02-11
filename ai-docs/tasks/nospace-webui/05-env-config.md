# 環境設定・.env 設計

## 概要

サーバーサイドの設定（nospace20 実行ファイルパス等）を `.env` ファイルで管理する。

## .env 読み込み戦略

### 考察

いくつかの方法を検討した:

| 方式 | メリット | デメリット |
|------|---------|-----------|
| `dotenv` + `.env` / `.env.local` | シンプル、Node.js で定番 | Vite 側の `.env` と混在する可能性 |
| Vite の組み込み env 機能のみ | Vite と統一 | サーバー側で使えない |
| `dotenv` をサーバー側のみ利用 + Vite 組み込みをクライアント側 | 各環境で最適 | 読み込みロジックが分散 |

### 採用方式

**`dotenv` パッケージをサーバー側で使用。Vite の組み込み機能もそのまま活用。**

理由:
- Vite はクライアント側の `VITE_` prefix 付き変数を自動で読み込む
- サーバー側は `dotenv` で明示的に読み込む
- `.env` 系ファイルの優先順序を明確にする

### ファイル構成

| ファイル | Git 管理 | 用途 |
|---------|---------|------|
| `.env.example` | ○（コミット） | 設定項目の一覧とデフォルト値。ドキュメンテーション目的 |
| `.env.local` | ×（.gitignore） | ローカル環境固有の設定。`.env.example` をコピーして編集 |

### 読み込み優先順序

1. 環境変数（`process.env`）— 最優先
2. `.env.local` — ローカルオーバーライド
3. `.env.example` — デフォルト値

`dotenv` の `override: false` オプションを利用し、先に読み込んだ値を後から上書きしないようにする。

```typescript
import dotenv from 'dotenv';

// .env.example を先に読み込み（デフォルト値として）
dotenv.config({ path: '.env.example' });
// .env.local で上書き
dotenv.config({ path: '.env.local', override: true });
```

実際には逆順で読み込む:

```typescript
// .env.local を先に読む（存在すれば）
dotenv.config({ path: '.env.local' });
// .env.example を後に読む（.env.local で設定済みの変数は上書きしない）
dotenv.config({ path: '.env.example' });
```

この方法なら `dotenv` のデフォルト動作（既存の環境変数を上書きしない）で正しく動く。

### .env.example 内容

```env
# nospace20 実行ファイルのパス
NOSPACE_BIN_PATH=./components/nospace20/bin/nospace20

# サーバーポート
PORT=8080

# フロントエンド配信モード (vite | static)
FRONTEND=vite

# プロセス実行タイムアウト（秒）
NOSPACE_TIMEOUT=30

# 同時実行プロセス数の上限
NOSPACE_MAX_PROCESSES=5
```

## Config.ts の変更

既存の `Config.ts` を拡張する。

```typescript
// src/app/Config.ts

import dotenv from 'dotenv';

// .env 読み込み
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.example' });

export default {
  production: process.env.NODE_ENV === 'production',
  httpPort: parseInt(process.env.PORT ?? '8080'),
  frontend: (process.env.FRONTEND ?? 'vite') as 'vite' | 'static',

  // nospace20 関連
  nospaceBinPath: process.env.NOSPACE_BIN_PATH ?? './components/nospace20/bin/nospace20',
  nospaceTimeout: parseInt(process.env.NOSPACE_TIMEOUT ?? '30') * 1000, // ms に変換
  nospaceMaxProcesses: parseInt(process.env.NOSPACE_MAX_PROCESSES ?? '5'),
};
```

## .gitignore 更新

以下を `.gitignore` に追加:

```
.env.local
```

## 依存パッケージ

```
npm install dotenv
```

## Vite クライアント側の設定

将来的に WASM flavor 切り替え等でクライアント側の設定が必要になった場合は、
Vite の `VITE_` prefix 変数を使う:

```env
# クライアント側設定の例（将来用）
VITE_FLAVOR=server
```

現時点ではクライアント側の `.env` 設定は不要。
