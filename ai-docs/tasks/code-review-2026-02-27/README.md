# コードレビュー 2026-02-27

`.github/skills/update-code/SKILL.md` の注意事項に対するコードベース全体のレビュー結果。

## 発見された問題カテゴリ

| # | ドキュメント | 概要 | 重大度 |
|---|---|---|---|
| 1 | [mock-violations.md](mock-violations.md) | テストコードでの jest.mock / jest.fn によるメソッド差し替え | High |
| 2 | [doc-comments.md](doc-comments.md) | 構造体のドキュメントコメント (JSDoc) 欠落 | Medium |
| 3 | [srp-violations.md](srp-violations.md) | 単一責任原則の違反 | Medium |

## 違反ルール一覧

| ルール | 状態 |
|---|---|
| 実際にリモートにアクセスしたりファイルを作成するテストの禁止 | **準拠** |
| Mock ライブラリによるメソッド差し替えの禁止 | **違反あり** → [mock-violations.md](mock-violations.md) |
| 単一責任原則 | **違反あり** → [srp-violations.md](srp-violations.md) |
| 構造体のドキュメントコメント追加 | **違反あり** → [doc-comments.md](doc-comments.md) |
| バグ修正時のコメント・テスト追加 | 該当なし（今回は新規バグ修正ではない） |
| Unit テストはモジュールごとに作成 | **軽微な違反** → [mock-violations.md](mock-violations.md) 末尾に記載 |
