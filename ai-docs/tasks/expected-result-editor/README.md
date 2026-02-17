# Expected Result 構造化エディタ

## 概要

テストケースの期待結果（`.check.json`）を、JSON テキストではなく構造化 UI フォームで編集できる機能。

## 目的

- JSON 構文エラーを防ぐ
- 複雑なスキーマ（配列、複数ケース）の編集を簡単にする
- 各スキーマ型に特化したフォームで直感的な編集を可能にする

## 対応スキーマ型

1. **Success (Trace)**: `trace_hit_counts` 配列
2. **Success (IO - Single)**: `stdin` / `stdout` 単一ケース
3. **Success (IO - Multiple)**: `cases` 配列（複数の stdin/stdout ペア）
4. **Compile Error**: `contains` 配列（エラーメッセージ部分文字列）
5. **Parse Error**: `phase` + `contains`（オプション）
6. **JSON Text**: 未対応スキーマのフォールバック

## ドキュメント

| ファイル | 説明 |
|---------|------|
| [00-overview.md](./00-overview.md) | 全体設計と背景 |
| [01-schema-and-parser.md](./01-schema-and-parser.md) | スキーマ型定義とパーサー実装 |
| [02-ui-components.md](./02-ui-components.md) | UI コンポーネント設計 |
| [03-implementation-plan.md](./03-implementation-plan.md) | 実装計画とスケジュール |

## 実装ステータス

### Phase 1: 基盤整備（優先度: 高）
- [ ] 型定義とパーサー
- [ ] CheckResultEditor 基本構造

### Phase 2: シンプルな型サポート（優先度: 高）
- [ ] Success (Trace) フォーム
- [ ] CheckResultFormView 統合

### Phase 3: 残りの型サポート（優先度: 中）
- [ ] Success (IO) フォーム
- [ ] Compile Error フォーム
- [ ] Parse Error フォーム

### Phase 4: UX 向上（優先度: 低）
- [ ] JSON プレビュー
- [ ] 型切り替え時の警告
- [ ] フィールドバリデーション強化

### Phase 5: テストとドキュメント（優先度: 中）
- [ ] コンポーネントユニットテスト
- [ ] 統合テスト
- [ ] ドキュメント更新

## 関連タスク

- [Test Editor](../../done-tasks/test-editor/) - テスト編集機能の基盤実装（完了）

## 備考

- 既存の JSON Text 編集モードは常に利用可能（フォールバック）
- 未対応スキーマでもアプリはクラッシュせず、JSON Text モードで編集可能
- 実装完了後、`ai-docs/done-tasks/expected-result-editor/` に移動
