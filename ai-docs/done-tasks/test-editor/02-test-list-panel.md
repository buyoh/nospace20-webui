# テスト編集機能: テスト一覧パネル

## 概要

テストケースをツリー形式で一覧表示し、選択・新規追加の操作を行うフロントエンドパネル。

## UI 構成

```
┌─────────────────────────────┐
│ [+ New Test]                │
│                             │
│ ▼ passes/                   │
│   ▼ operators/              │
│     ○ arith_001             │
│     ● arith_002  ←selected  │
│     ○ arith_003             │
│     ○ compare_001           │
│   ▶ control_flow/           │
│   ▶ functions/              │
│   ○ c000                    │
│   ○ c001                    │
│ ▼ fails/                    │
│   ▶ compile/                │
│   ▶ syntax/                 │
└─────────────────────────────┘
```

### 要素

- **New Test ボタン**: テストケース新規作成フォームを開く
- **ディレクトリノード**: クリックで展開・折りたたみ（▼/▶）
- **テストケースノード**: クリックで選択 → TestEditorPanel に詳細表示
- **選択状態**: ハイライト表示（`●` vs `○`）
- `hasCheck` が `false` のテストケースは視覚的にマーク（check.json なし）

## Store（Jotai Atoms）

### `src/web/stores/testEditorAtom.ts`（新規）

```typescript
import { atom } from 'jotai';
import type { TestTreeNode } from '../../interfaces/TestTypes';

/** テストファイルツリー */
export const testTreeAtom = atom<TestTreeNode[]>([]);

/** 現在選択中のテストケースのパス（拡張子なし） */
export const selectedTestPathAtom = atom<string | null>(null);

/** テスト一覧のローディング状態 */
export const testTreeLoadingAtom = atom<boolean>(false);

/** テスト一覧のエラー */
export const testTreeErrorAtom = atom<string | null>(null);
```

## Service

### `src/web/services/TestApiClient.ts`（新規）

サーバーの REST API と通信するクライアント。

```typescript
import type {
  TestTreeResponse,
  TestCaseResponse,
  TestCaseUpdateRequest,
  TestCaseCreateRequest,
} from '../../interfaces/TestTypes';

export class TestApiClient {
  /** テストツリーを取得 */
  async fetchTree(): Promise<TestTreeResponse>;

  /** テストケースの詳細を取得 */
  async fetchTestCase(path: string): Promise<TestCaseResponse>;

  /** テストケースを更新 */
  async updateTestCase(path: string, data: TestCaseUpdateRequest): Promise<void>;

  /** テストケースを作成 */
  async createTestCase(data: TestCaseCreateRequest): Promise<void>;
}

/** デフォルトインスタンス */
export const testApiClient = new TestApiClient();
```

## Hook

### `src/web/hooks/useTestTree.ts`（新規）

```typescript
export function useTestTree() {
  /** テストツリーをサーバーから取得してatomに反映 */
  const loadTree: () => Promise<void>;

  /** テストケースを選択 */
  const selectTest: (path: string) => void;

  return {
    tree,           // TestTreeNode[]
    selectedPath,   // string | null
    isLoading,      // boolean
    error,          // string | null
    loadTree,
    selectTest,
  };
}
```

## Component

### `src/web/components/test-editor/TestListPanel.tsx`（新規）

```typescript
interface TestListPanelProps {
  onCreateNew: () => void;
}
```

**機能:**
- マウント時にテストツリーを読み込み
- ツリーをディレクトリ・テストケースのネスト構造で描画
- ディレクトリの展開・折りたたみ状態はローカル state で管理
- テストケースクリック時: `selectedTestPathAtom` を更新
- `+ New Test` ボタンクリック時: `onCreateNew` コールバック

### `src/web/components/test-editor/TestTreeNode.tsx`（新規）

ツリーの1ノード（ディレクトリまたはテストケース）を描画する再帰コンポーネント。

```typescript
interface TestTreeNodeProps {
  node: TestTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth: number;
}
```

## スタイル

### `src/web/components/test-editor/styles/TestListPanel.scss`（新規）

- ツリーのインデント（depth × 16px）
- ディレクトリ: フォルダアイコン風、ボールド
- テストケース: 通常テキスト
- 選択状態: 背景色ハイライト
- `hasCheck=false`: ファイル名に薄い警告色
- スクロール可能なリスト領域
