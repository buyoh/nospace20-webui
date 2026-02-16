# テスト編集機能: テスト編集パネル

## 概要

選択されたテストケースの `.ns` ソースコードと `.check.json` 期待結果を編集するパネル、および新規テストケース作成フォーム。

## UI 構成

### 編集モード（既存テストケース選択時）

```
┌──────────────────────────────────────┐
│ passes/operators/arith_002           │
│                                      │
│ Source (.ns)                         │
│ ┌──────────────────────────────────┐ │
│ │ func: main() {                   │ │
│ │   __trace(0);                    │ │
│ │   let:x;                         │ │
│ │   x = 2 + 3;                     │ │
│ │   __assert(x == 5);              │ │
│ │ }                                │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Expected Result (.check.json)        │
│ ┌──────────────────────────────────┐ │
│ │ {                                │ │
│ │   "trace_hit_counts": [1]        │ │
│ │ }                                │ │
│ └──────────────────────────────────┘ │
│                                      │
│              [Save]                  │
└──────────────────────────────────────┘
```

### 新規作成モード

```
┌──────────────────────────────────────┐
│ New Test Case                        │
│                                      │
│ Category: [passes/operators ▼]       │
│ File name: [________________]        │
│                                      │
│ Source (.ns)                         │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Expected Result (.check.json)        │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│           [Create]  [Cancel]         │
└──────────────────────────────────────┘
```

## Store（Jotai Atoms）

### `src/web/stores/testEditorAtom.ts`（追加分）

```typescript
/** 現在編集中のテストケースデータ */
export const editingTestCaseAtom = atom<{
  path: string;
  source: string;
  check: string | null;
} | null>(null);

/** エディタの変更状態（dirty flag） */
export const testEditorDirtyAtom = atom<boolean>(false);

/** 保存処理中 */
export const testEditorSavingAtom = atom<boolean>(false);

/** 新規作成モードか */
export const testEditorCreateModeAtom = atom<boolean>(false);
```

## Hook

### `src/web/hooks/useTestEditor.ts`（新規）

```typescript
export function useTestEditor() {
  /** テストケースをロード（選択変更時に呼ばれる） */
  const loadTestCase: (path: string) => Promise<void>;

  /** ソースコードを更新 */
  const updateSource: (source: string) => void;

  /** check.json を更新 */
  const updateCheck: (check: string) => void;

  /** 保存 */
  const save: () => Promise<void>;

  /** 新規作成（カテゴリ + ファイル名 + ソース + check） */
  const create: (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }) => Promise<void>;

  /** 新規作成モードを開始 */
  const startCreate: () => void;

  /** 新規作成モードをキャンセル */
  const cancelCreate: () => void;

  return {
    testCase,       // editingTestCaseAtom の値
    isDirty,        // 変更があるか
    isSaving,       // 保存中か
    isCreateMode,   // 新規作成モードか
    loadTestCase,
    updateSource,
    updateCheck,
    save,
    create,
    startCreate,
    cancelCreate,
  };
}
```

## Component

### `src/web/components/test-editor/TestEditorPanel.tsx`（新規）

テストケース編集パネルの親コンポーネント。選択状態に応じて表示を切り替える。

```typescript
export const TestEditorPanel: React.FC = () => {
  // selectedTestPathAtom が null && !isCreateMode → 未選択メッセージ
  // isCreateMode → TestCaseCreateForm
  // selectedTestPathAtom が non-null → TestCaseEditForm
};
```

### `src/web/components/test-editor/TestCaseEditForm.tsx`（新規）

既存テストケースの編集フォーム。

```typescript
interface TestCaseEditFormProps {
  testCase: { path: string; source: string; check: string | null };
  isDirty: boolean;
  isSaving: boolean;
  onSourceChange: (source: string) => void;
  onCheckChange: (check: string) => void;
  onSave: () => void;
}
```

**機能:**
- パス表示（読み取り専用）
- ソースコードエディタ: `<textarea>` または `<CodeTextarea>` を流用
- check.json エディタ: `<textarea>` で JSON テキスト編集
- Save ボタン: dirty 状態の場合のみ有効
- 保存成功時: dirty フラグリセット + テストツリーリロード（hasCheck の変更反映）

### `src/web/components/test-editor/TestCaseCreateForm.tsx`（新規）

新規テストケース作成フォーム。

```typescript
interface TestCaseCreateFormProps {
  categories: string[];  // 利用可能なディレクトリ一覧
  onSubmit: (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}
```

**機能:**
- カテゴリ選択（`<select>`）: テストツリーのディレクトリパス一覧
- ファイル名入力（`<input>`）: 拡張子なし、バリデーション（英数字・アンダースコア・ハイフン）
- ソースコードエディタ
- check.json エディタ
- Create ボタン: カテゴリ + ファイル名 + ソースが入力済みの場合のみ有効
- Cancel ボタン: 新規作成モードを終了
- 作成成功時: テストツリーリロード + 作成したテストケースを自動選択

## エディタの選択

- `.ns` ソースコード: 既存の `CodeTextarea` コンポーネントを流用
  - Ace Editor は左ペインの EditorContainer で使用しており、同時に2つインスタンスを描画するのは重いため避ける
  - 将来的には軽量エディタに置き換え可能
- `.check.json`: プレーンな `<textarea>`
  - JSON バリデーション（フォーマットエラーの表示）を追加

## スタイル

### `src/web/components/test-editor/styles/TestEditorPanel.scss`（新規）

- 編集領域は縦方向にスクロール可能
- パス表示: モノスペースフォント、背景色つき
- テキストエリア: モノスペースフォント、幅100%
- ソースエディタ: 高さ 40% 程度（リサイズ可能）
- check エディタ: 高さ 20% 程度（リサイズ可能）
- Save / Create ボタン: プライマリカラー
- Cancel ボタン: セカンダリカラー
- dirty 状態の表示: パス横に「*」または変更インジケータ
