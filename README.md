# nospace20-webui

## 技術スタック

- **フロントエンド**: React 18 + TypeScript + Vite
- **状態管理**: Jotai
- **バックエンド**: Node.js + Express + Socket.IO
- **スタイル**: SCSS

## 機能

- サーバーで管理される1つのカウンター
- 複数のクライアント間でリアルタイム共有
- +1 / -1 / リセットの操作

## 開発

```bash
# 依存関係のインストール
yarn install

# 開発サーバー起動
yarn dev

# テスト実行
yarn test

# ビルド
yarn build
```

## 設定（サーバー）

サーバー・Vite の設定は JavaScript（CommonJS）の設定ファイルで与える。値の定義元は `env.example.js`（必須）で、`env.local.js`（任意・git 管理外）と実際の環境変数で上書きできる（優先順位は 環境変数 > `env.local.js` > `env.example.js`）。`env.local.js` には `env.example.js` と同じ形式で、上書きしたいキーだけを書く。

- コード側にデフォルト値は持たない。`env.example.js` が存在しない、または必須の値が未定義・不正な場合は起動に失敗する。未知のキーもエラーになる
- 設定ファイルの値は `process.env` に反映されない（nospace20 の子プロセスにも渡らない）。子プロセスにはロケール等の許可リストの環境変数だけを渡す
- `NODE_ENV` を設定ファイルに書いた場合はサーバーの本番判定にのみ使われる。Express 等にも反映するには環境変数で指定する（`npm run prod` を参照）
- 設定ファイルを編集した場合はサーバーの再起動が必要
- 以前の `.env.example` / `.env.local` は使われない。`.env.local` を使っていた場合は `env.local.js` に移すこと
- `NOSPACE_TEST_DIR` のみ空文字を許容する（テスト管理 API を無効にする）
- サーバーを起動すること自体がテスト環境であることを意味する（native 実行環境は外部公開を想定しない）

## ディレクトリ構造

```
src/
├── app/                # サーバーサイド
│   ├── Services/       # ビジネスロジック
│   └── Web/            # Express関連
├── interfaces/         # 共通型定義
├── tests/              # テストコード
└── web/                # クライアントサイド
    ├── components/     # UIコンポーネント
    ├── containers/     # 状態を持つコンポーネント
    ├── hooks/          # カスタムフック
    ├── pages/          # ページコンポーネント
    └── stores/         # Jotai atoms
```
