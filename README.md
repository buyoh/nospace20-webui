# Counter App

WebSocket経由で共有されるカウンターアプリケーション

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
