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

サーバーの設定は環境変数で与える。値の定義元は `.env.example`（必須）で、`.env.local`（任意）と実際の環境変数で上書きできる（優先順位は 環境変数 > `.env.local` > `.env.example`）。

- コード側にデフォルト値は持たない。`.env.example` が存在しない、または必須の値が未定義・不正な場合は起動に失敗する
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
