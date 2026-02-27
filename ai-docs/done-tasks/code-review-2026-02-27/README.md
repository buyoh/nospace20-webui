# コードレビュー 2026-02-27

`.github/skills/update-code/SKILL.md` の注意事項に対するコードベース全体のレビュー結果。

## 発見された問題カテゴリ

| # | ドキュメント | 概要 | 重大度 | 状態 |
|---|---|---|---|---|
| 1 | [mock-violations.md](mock-violations.md) | テストコードでの jest.mock / jest.fn によるメソッド差し替え | High | **完了** |
| 2 | ~~doc-comments.md~~ | 構造体のドキュメントコメント (JSDoc) 欠落 | Medium | **完了** → `done-tasks/doc-comments.md` |
| 3 | [srp-violations.md](srp-violations.md) | 単一責任原則の違反 | Medium | **Phase1-2 完了 / Phase3 未対応（Low優先度）** |

## 違反ルール一覧

| ルール | 状態 |
|---|---|
| 実際にリモートにアクセスしたりファイルを作成するテストの禁止 | **準拠** |
| Mock ライブラリによるメソッド差し替えの禁止 | **完了** → [mock-violations.md](mock-violations.md) |
| 単一責任原則 | **Phase1-2 完了** / Phase3(Low)未対応 → [srp-violations.md](srp-violations.md) |
| 構造体のドキュメントコメント追加 | **完了** → `done-tasks/doc-comments.md` |
| バグ修正時のコメント・テスト追加 | 該当なし（今回は新規バグ修正ではない） |
| Unit テストはモジュールごとに作成 | **完了** → [mock-violations.md](mock-violations.md) 末尾に記載 |
