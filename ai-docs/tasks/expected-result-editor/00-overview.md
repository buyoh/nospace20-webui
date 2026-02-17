# Expected Result 構造化エディタ 設計概要

## 目的

テストケースの期待結果（`.check.json`）を、JSON テキストとして直接編集するのではなく、スキーマに応じた構造化 UI フォームで編集できる機能を追加する。

## 背景

### 現状の課題

現在の実装（`TestCaseEditForm.tsx`）では、`.check.json` ファイルを単純な `<textarea>` で編集している：

- JSON 構文エラーが発生しやすい
- スキーマのバリエーションが多様で、記述ルールを覚える必要がある
- 配列要素（trace_hit_counts, cases, contains）の追加・削除が煩雑
- IO テストケースの複数ケース管理が難しい

### check.json のスキーマバリエーション

```jsonc
// 1. 成功（trace ベース検証）- 最もシンプル
{ "trace_hit_counts": [1] }

// 2. 成功（trace ベース検証、type 明示）
{ "type": "success", "trace_hit_counts": [1, 1, 1] }

// 3. 成功（IO ベース検証 - 単一ケース）
{ "type": "success_io", "stdin": "ABC", "stdout": "ABC" }

// 4. 成功（IO ベース検証 - 複数ケース）
{
  "type": "success_io",
  "cases": [
    { "name": "positive", "stdin": "42\n", "stdout": "42" },
    { "name": "zero", "stdin": "0\n", "stdout": "0" }
  ]
}

// 5. コンパイルエラー検証
{ "type": "compile_error", "contains": ["error message substring"] }

// 6. パースエラー検証
{ "type": "parse_error", "phase": "tree" }
{ "type": "parse_error", "phase": "tokenize", "contains": ["error detail"] }
```

## 機能要件

### 1. スキーマ型の自動判定

- 既存の `.check.json` 内容から、6つのパターンのいずれかを自動判定
- 判定できない場合は「不明（JSON テキストモード）」にフォールバック

### 2. 型選択 UI

- ドロップダウンで期待結果の種類を選択：
  - `Success (Trace)` - trace_hit_counts ベース
  - `Success (IO)` - stdin/stdout ベース
  - `Compile Error` - コンパイルエラー検証
  - `Parse Error` - パースエラー検証
  - `JSON Text` - 手動 JSON 編集
- 型変更時は既存データを可能な限り保持（または警告）

### 3. 各型に対応した構造化フォーム

#### Success (Trace) フォーム

- trace_hit_counts の配列エディタ
  - 各要素に数値入力フィールド
  - 要素の追加・削除ボタン
  - 順序入れ替え（オプション）

#### Success (IO) フォーム

- **単一ケースモード:**
  - stdin テキストエリア
  - stdout テキストエリア

- **複数ケースモード:**
  - ケース一覧（追加・削除可能）
  - 各ケース:
    - name 入力
    - stdin テキストエリア
    - stdout テキストエリア

#### Compile Error フォーム

- contains 配列エディタ
  - エラーメッセージ部分文字列の入力フィールド（複数）
  - 要素の追加・削除ボタン

#### Parse Error フォーム

- phase ラジオボタン: `tree` / `tokenize`
- contains 配列エディタ（オプション）
  - エラー詳細の部分文字列入力フィールド

### 4. JSON テキストモード（フォールバック）

- 構造化フォームで対応できない複雑なスキーマや、将来追加されるスキーマのために、従来通りの JSON テキストエディタも選択可能
- JSON バリデーション表示（構文エラーの行番号・メッセージ）

### 5. プレビュー機能

- 構造化フォームから生成される JSON をリアルタイムプレビュー
- 切り替えボタンで「フォームビュー」「JSON プレビュー」を表示切り替え

## UI 構成案

```
┌──────────────────────────────────────────────────┐
│ passes/operators/arith_002                       │
│                                                  │
│ Expected Result (.check.json)                    │
│ ┌──────────────────────────────────────────────┐ │
│ │  Type: [Success (Trace)        ▼]            │ │
│ │  Mode: ○ Form  ○ JSON Text                   │ │
│ │ ─────────────────────────────────────────────│ │
│ │  Trace Hit Counts:                           │ │
│ │  [ 1 ] [×]                                   │ │
│ │  [ 1 ] [×]                                   │ │
│ │  [ 1 ] [×]                                   │ │
│ │  [+ Add]                                     │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ JSON Preview:                                    │
│ ┌──────────────────────────────────────────────┐ │
│ │ {                                            │ │
│ │   "type": "success",                         │ │
│ │   "trace_hit_counts": [1, 1, 1]              │ │
│ │ }                                            │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│           [Save]  [Revert]                       │
└──────────────────────────────────────────────────┘
```

## 技術方針

### スキーマの型定義

`src/interfaces/CheckResultSchema.ts`（新規）に TypeScript 型を定義：

```typescript
export type CheckResultType = 
  | 'success' 
  | 'success_io' 
  | 'compile_error' 
  | 'parse_error' 
  | 'unknown';

export interface SuccessTraceSchema {
  type?: 'success';
  trace_hit_counts: number[];
}

export interface SuccessIOSingleSchema {
  type: 'success_io';
  stdin: string;
  stdout: string;
}

export interface SuccessIOMultiSchema {
  type: 'success_io';
  cases: Array<{
    name: string;
    stdin: string;
    stdout: string;
  }>;
}

export interface CompileErrorSchema {
  type: 'compile_error';
  contains: string[];
}

export interface ParseErrorSchema {
  type: 'parse_error';
  phase: 'tree' | 'tokenize';
  contains?: string[];
}

export type CheckResultSchema = 
  | SuccessTraceSchema 
  | SuccessIOSingleSchema 
  | SuccessIOMultiSchema 
  | CompileErrorSchema 
  | ParseErrorSchema;
```

### コンポーネント構成

```
CheckResultEditor (新規)
├── CheckResultTypeSelector (型選択ドロップダウン)
├── CheckResultFormView (構造化フォーム)
│   ├── SuccessTraceForm
│   ├── SuccessIOForm (単一/複数ケース対応)
│   ├── CompileErrorForm
│   └── ParseErrorForm
├── CheckResultJsonView (JSON テキストエディタ)
└── CheckResultPreview (JSON プレビュー)
```

### ユーティリティ関数

`src/web/libs/checkResultParser.ts`（新規）:

- `parseCheckResult(json: string): CheckResultSchema | null` - JSON を解析
- `detectCheckResultType(schema: any): CheckResultType` - 型を自動判定
- `serializeCheckResult(schema: CheckResultSchema): string` - JSON に変換

### 既存コンポーネントの変更

- `TestCaseEditForm.tsx`:
  - `<textarea>` を `<CheckResultEditor>` に置き換え
  - `onCheckChange` は内部で JSON 文字列に変換してから呼び出し

## 非機能要件

- **パフォーマンス**: 大きな配列（100+ 要素）でも快適に動作
- **バリデーション**: 各フィールドの入力値を検証（例: trace_hit_counts は非負整数）
- **エラーハンドリング**: 不正な JSON や未対応スキーマでもクラッシュせず、テキストモードにフォールバック
- **ユーザビリティ**: 型切り替え時にデータ損失の警告を表示

## 実装の優先順位

### Phase 1: 基盤整備
- [ ] スキーマ型定義（`CheckResultSchema.ts`）
- [ ] パーサー・シリアライザ実装（`checkResultParser.ts`）
- [ ] 型判定ロジックのユニットテスト

### Phase 2: UI コンポーネント
- [ ] `CheckResultEditor` 基本構造
- [ ] `SuccessTraceForm`（最も単純）
- [ ] `CheckResultJsonView`（フォールバック）
- [ ] `TestCaseEditForm` への統合

### Phase 3: 高度な型サポート
- [ ] `SuccessIOForm`（単一・複数ケース）
- [ ] `CompileErrorForm`
- [ ] `ParseErrorForm`

### Phase 4: UX 向上
- [ ] JSON プレビュー表示
- [ ] 型切り替え時の警告ダイアログ
- [ ] フィールドバリデーション強化

## 関連ドキュメント

- [ai-docs/done-tasks/test-editor/00-overview.md](../../done-tasks/test-editor/00-overview.md) - テスト編集機能の全体設計
- [ai-docs/done-tasks/test-editor/03-test-editor-panel.md](../../done-tasks/test-editor/03-test-editor-panel.md) - 既存の編集パネル実装
