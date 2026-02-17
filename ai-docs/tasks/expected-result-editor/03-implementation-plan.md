# Expected Result 構造化エディタ: 実装計画

## 実装の段階的アプローチ

### Phase 1: 基盤整備（優先度: 高）

#### 1-1. 型定義とパーサー実装

**タスク:**
- [ ] `src/interfaces/CheckResultSchema.ts` 型定義を作成
- [ ] `src/web/libs/checkResultParser.ts` パーサー・シリアライザ実装
- [ ] `src/tests/web/libs/checkResultParser.test.ts` ユニットテスト

**見積もり:** 3-4時間

**依存関係:** なし

**検証方法:**
- ユニットテストが全てパス
- 実際のテストケースの `.check.json` ファイルでパースが成功することを確認

---

#### 1-2. CheckResultEditor 基本構造

**タスク:**
- [ ] `src/web/components/test-editor/CheckResultEditor.tsx` 親コンポーネント作成
  - 型選択ドロップダウン（`CheckResultTypeSelector`）
  - モード切り替え（`CheckResultModeToggle`）
  - JSON Text ビュー（`CheckResultJsonView`）統合
- [ ] `src/web/components/test-editor/styles/CheckResultEditor.scss` スタイル作成

**見積もり:** 2-3時間

**依存関係:** 1-1 完了後

**検証方法:**
- JSON Text モードで既存の `.check.json` を読み込み・編集・保存できることを確認
- 型選択ドロップダウンが動作することを確認（まだフォームは未実装）

---

### Phase 2: 最もシンプルな型のサポート（優先度: 高）

#### 2-1. Success (Trace) フォーム

**タスク:**
- [ ] `src/web/components/test-editor/check-result-forms/SuccessTraceForm.tsx` 実装
  - `trace_hit_counts` 配列エディタ
  - 要素の追加・削除・編集
- [ ] スタイル調整（配列エディタの UI）

**見積もり:** 2-3時間

**依存関係:** 1-2 完了後

**検証方法:**
- `trace_hit_counts` を持つテストケースでフォーム編集が動作
- 配列要素の追加・削除が正しく JSON に反映される

---

#### 2-2. CheckResultFormView 統合

**タスク:**
- [ ] `CheckResultFormView` コンポーネント作成（型による分岐）
- [ ] `CheckResultEditor` に統合
- [ ] Form ⇔ JSON Text モード切り替えのテスト

**見積もり:** 1-2時間

**依存関係:** 2-1 完了後

**検証方法:**
- Form モードと JSON Text モードを切り替えてデータが保持されることを確認

---

### Phase 3: 残りの型サポート（優先度: 中）

#### 3-1. Success (IO) フォーム

**タスク:**
- [ ] `src/web/components/test-editor/check-result-forms/SuccessIOForm.tsx` 実装
  - 単一ケースモード（stdin/stdout）
  - 複数ケースモード（cases 配列）
  - モード切り替え

**見積もり:** 3-4時間

**依存関係:** 2-2 完了後

**検証方法:**
- 単一ケースと複数ケースのテストケースで編集が動作
- ケースの追加・削除が正しく動作

---

#### 3-2. Compile Error フォーム

**タスク:**
- [ ] `src/web/components/test-editor/check-result-forms/CompileErrorForm.tsx` 実装
  - `contains` 配列エディタ

**見積もり:** 1-2時間

**依存関係:** 2-2 完了後

**検証方法:**
- コンパイルエラーテストケースでフォーム編集が動作

---

#### 3-3. Parse Error フォーム

**タスク:**
- [ ] `src/web/components/test-editor/check-result-forms/ParseErrorForm.tsx` 実装
  - `phase` ラジオボタン
  - `contains` 配列エディタ（オプション）

**見積もり:** 1-2時間

**依存関係:** 2-2 完了後

**検証方法:**
- パースエラーテストケースでフォーム編集が動作

---

### Phase 4: UX 向上（優先度: 低）

#### 4-1. JSON プレビュー

**タスク:**
- [ ] `CheckResultPreview` コンポーネント実装
- [ ] Form モード時にリアルタイムプレビューを表示

**見積もり:** 1時間

**依存関係:** Phase 2 完了後

**検証方法:**
- フォーム編集時に JSON プレビューがリアルタイム更新される

---

#### 4-2. 型切り替え時の警告

**タスク:**
- [ ] 型変更時に既存データが失われる可能性がある場合に警告ダイアログを表示
- [ ] `window.confirm()` または専用ダイアログコンポーネント

**見積もり:** 1-2時間

**依存関係:** Phase 3 完了後

**検証方法:**
- データがある状態で型を変更すると警告が表示される
- キャンセルを選択すると変更が取り消される

---

#### 4-3. フィールドバリデーション強化

**タスク:**
- [ ] 各フォームでの入力バリデーション（リアルタイム）
- [ ] エラーメッセージの表示（フィールドごと）
- [ ] バリデーションエラー時の保存ボタン無効化（オプション）

**見積もり:** 2-3時間

**依存関係:** Phase 3 完了後

**検証方法:**
- 不正な値を入力するとエラーメッセージが表示される
- バリデーションエラーがあっても保存は可能（柔軟性のため）

---

### Phase 5: テストとドキュメント（優先度: 中）

#### 5-1. コンポーネントユニットテスト

**タスク:**
- [ ] `CheckResultEditor.test.tsx` - 親コンポーネントのテスト
- [ ] `SuccessTraceForm.test.tsx` - 各フォームのテスト
- [ ] `SuccessIOForm.test.tsx`
- [ ] `CompileErrorForm.test.tsx`
- [ ] `ParseErrorForm.test.tsx`

**見積もり:** 4-5時間

**依存関係:** Phase 3 完了後

**検証方法:**
- Jest でのカバレッジ率 80% 以上

---

#### 5-2. 統合テスト

**タスク:**
- [ ] `TestCaseEditForm` との統合確認
- [ ] 実際のテストケースファイルを使った E2E シナリオ
  - 既存テストケースの読み込み → フォーム編集 → 保存 → 再読み込み

**見積もり:** 2-3時間

**依存関係:** 5-1 完了後

**検証方法:**
- 統合テストが全てパス
- 手動で複数のテストケースを編集して問題ないことを確認

---

#### 5-3. ドキュメント更新

**タスク:**
- [ ] `ai-docs/done-tasks/expected-result-editor/` に実装内容を移動
- [ ] `README.md` に機能説明を追加
- [ ] コンポーネントの JSDoc コメント追加

**見積もり:** 1時間

**依存関係:** Phase 5 完了後

---

## ファイル作成・変更一覧

### 新規作成

| ファイル | Phase | 説明 |
|---------|-------|------|
| `src/interfaces/CheckResultSchema.ts` | 1-1 | スキーマ型定義 |
| `src/web/libs/checkResultParser.ts` | 1-1 | パーサー・シリアライザ |
| `src/tests/web/libs/checkResultParser.test.ts` | 1-1 | パーサーのユニットテスト |
| `src/web/components/test-editor/CheckResultEditor.tsx` | 1-2 | メインエディタコンポーネント |
| `src/web/components/test-editor/styles/CheckResultEditor.scss` | 1-2 | スタイル |
| `src/web/components/test-editor/check-result-forms/SuccessTraceForm.tsx` | 2-1 | Trace フォーム |
| `src/web/components/test-editor/check-result-forms/SuccessIOForm.tsx` | 3-1 | IO フォーム |
| `src/web/components/test-editor/check-result-forms/CompileErrorForm.tsx` | 3-2 | Compile Error フォーム |
| `src/web/components/test-editor/check-result-forms/ParseErrorForm.tsx` | 3-3 | Parse Error フォーム |
| `src/tests/web/components/test-editor/CheckResultEditor.test.tsx` | 5-1 | コンポーネントテスト |

### 変更

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `src/web/components/test-editor/TestCaseEditForm.tsx` | 2-2 | `<textarea>` を `<CheckResultEditor>` に置き換え |
| `src/web/components/test-editor/TestCaseCreateForm.tsx` | 2-2 | 同上（新規作成時のデフォルト値対応） |

---

## 実装の注意点

### 1. 既存機能との互換性

- **JSON Text モード**は常に利用可能にする（フォールバック）
- 既存の `.check.json` ファイルが未対応スキーマでも編集・保存できること
- `TestCaseEditForm` の `onCheckChange` は引き続き JSON 文字列を受け取る

### 2. パフォーマンス

- 大きな配列（`trace_hit_counts` が 100+ 要素）でも快適に動作すること
- 配列要素の追加・削除時に不要な再レンダリングを避ける（`useCallback`, `useMemo`）

### 3. エラーハンドリング

- JSON パースエラーは UI に表示するが、アプリをクラッシュさせない
- バリデーションエラーでも保存は可能（ユーザーの柔軟性を優先）

### 4. ユーザビリティ

- 型切り替え時のデータ損失警告
- 配列の最後の要素は削除不可（空にしない）
- フォームのフィールドにプレースホルダーを表示

### 5. テスト戦略

- **ユニットテスト**: パーサー・各フォームコンポーネント
- **統合テスト**: `CheckResultEditor` 全体の動作
- **手動テスト**: 実際のテストケースファイルを使った E2E

---

## 開発スケジュール（目安）

| Phase | 見積もり時間 | 優先度 |
|-------|------------|--------|
| Phase 1 | 5-7時間 | 高 |
| Phase 2 | 3-5時間 | 高 |
| Phase 3 | 5-8時間 | 中 |
| Phase 4 | 4-6時間 | 低 |
| Phase 5 | 7-9時間 | 中 |
| **合計** | **24-35時間** | - |

### 推奨アプローチ

1. **Phase 1 → Phase 2**: まず最も単純な Trace 型をサポートし、動作確認
2. **Phase 3**: 残りの型を順次実装（並行可能）
3. **Phase 4**: UX 向上は後回しでも OK
4. **Phase 5**: テストとドキュメントは各 Phase 完了時に少しずつ実施

---

## リスクと対処

### リスク 1: 未知のスキーマパターン

**内容:** 実際のテストケースに、ドキュメント化されていないスキーマパターンが存在する可能性

**対処:**
- Phase 1 でパーサーを実装後、全ての `.check.json` をパースして型分布を調査
- `unknown` 型にフォールバックする仕組みを維持

### リスク 2: 複雑な配列操作での UX 問題

**内容:** 100個以上の `trace_hit_counts` を持つテストケースでの編集が煩雑

**対処:**
- Phase 4 で「一括編集」「CSV インポート」などの機能を検討
- JSON Text モードを常に利用可能にしておく

### リスク 3: 型変更時のデータ損失

**内容:** ユーザーが誤って型を変更してデータを失う

**対処:**
- Phase 4-2 で警告ダイアログを実装
- ブラウザの `beforeunload` イベントで未保存データを警告（既存機能）

---

## 完了条件

- [ ] Phase 1-3 が完了し、6つのスキーマ型すべてがサポートされている
- [ ] 既存の `.check.json` ファイルをフォーム編集で正しく保存できる
- [ ] ユニットテストのカバレッジ率が 80% 以上
- [ ] 手動テストで主要なテストケースの編集が問題なく動作
- [ ] ドキュメントが更新されている
