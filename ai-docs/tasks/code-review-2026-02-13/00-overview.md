# コードレビュー 2026-02-13: update-code SKILL 注意事項違反

## 概要

`update-code/SKILL.md` の注意事項に対して、ソースコード・テストコード・設定ファイルを確認した結果、以下の違反を検出した。

## 検出された問題一覧

| # | カテゴリ | 重要度 | 概要 | 詳細ドキュメント |
|---|---------|--------|------|----------------|
| 1 | jest.mock 使用禁止違反 | 高 | テストで `jest.mock` によるモジュール差し替えが複数箇所で使用されている | [01-jest-mock-violations.md](01-jest-mock-violations.md) |
| 2 | ドキュメントコメント不足 | 中 | 構造体・インターフェースにドキュメントコメントが不足している | [02-missing-doc-comments.md](02-missing-doc-comments.md) |
| 3 | デッドコード・テスト不整合 | 高 | `useNospaceSocket` が未使用、対応テストが旧APIのまま | [03-dead-code-and-stale-tests.md](03-dead-code-and-stale-tests.md) |

## 対応する SKILL ルール

```
- Mock ライブラリ等によるメソッドの差し替えは禁止。依存性注入やテンプレートを使用する
- 構造体の概要は必ずドキュメントコメントとして追加する。関数は規模が小さい場合、省略する
- Unitテストはモジュールごとに作成する
```
