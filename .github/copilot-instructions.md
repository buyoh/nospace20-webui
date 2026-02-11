# 概要

独自のプログラミング言語 `nospace` と esolang の `whitespace` を実行する UI を備えたアプリケーション。
コンパイラ・インタプリタは別リポジトリで開発され、wasm や実行ファイルとして提供される。

## 技術スタック

- **フロントエンド**: React 18 + TypeScript + Vite
- **状態管理**: Jotai（関数コンポーネント + Hooks）
- **バックエンド**: Node.js + Express + Socket.IO
- **スタイル**: SCSS

ファイル削除を行うときは、`rm` `rmdir` コマンドではなく、`.trash/` ディレクトリに移動。

## ドキュメント

AI 向けのドキュメントは `ai-docs/` ディレクトリに配置される。

## ディレクトリ構造

### src

```
src/
├── app/                # サーバーサイドアプリケーションのコード
│   ├── Controllers/    # コントローラー
│   ├── Models/         # データモデル
│   ├── Routes/         # ルーティング
│   ├── Web/            # ビュー・ミドルウェア
│   └── Services/       # ビジネスロジック
├── interfaces/         # サーバ・クライアント共通データ型
├── lib/                # サーバ・クライアント共通ライブラリ
├── tests/              # テストコード
│   ├── app/            # サーバーサイドのテスト
│   └── web/            # クライアントサイドのテスト
└── web/                # クライアントサイドアプリケーションのコード
    ├── components/     # Reactコンポーネント（関数コンポーネント）
    ├── containers/     # 状態を持つReactコンポーネント
    ├── hooks/          # カスタムフック
    ├── pages/          # ページコンポーネント
    ├── services/       # API通信などのサービス
    ├── stores/         # Jotai atoms
    └── styles/         # スタイルシート
```

## テストについて

- テストは「Unitテスト」「largeテスト」の2種類
- 動作確認等のため一時ディレクトリ・ファイルが必要なときは、`./tmp` ディレクトリを使う。
- `wsc` は `./tools/wsc-install/bin/wsc` にある

## Git について

コミットには以下のアカウントを設定してね
同時に別の Agent が修正を行っているかもしれないため、修正するファイルだけをコミットしてね

- name: buyoh
- email: 15198247+buyoh@users.noreply.github.com
