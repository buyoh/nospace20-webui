# テスト編集機能: ユニットテスト戦略

## 概要

テスト編集機能の各モジュールに対するユニットテスト方針。
既存プロジェクトのテストパターン（DI + Fake オブジェクト、`createStore` + Jotai `<Provider>`、`renderHook` + `wrapper`）に従い、`jest.mock()` の使用を最小限に抑える。

## テストファイル一覧

| テストファイル | テスト対象 | 種別 |
|---|---|---|
| `src/tests/app/TestFileService.spec.ts` | `TestFileService` | サーバーサイド |
| `src/tests/app/TestController.spec.ts` | `TestController` | サーバーサイド |
| `src/tests/web/TestApiClient.spec.ts` | `TestApiClient` | フロントエンド |
| `src/tests/web/useTestTree.spec.tsx` | `useTestTree` | フロントエンド Hook |
| `src/tests/web/useTestEditor.spec.tsx` | `useTestEditor` | フロントエンド Hook |
| `src/tests/web/TestListPanel.spec.tsx` | `TestListPanel` | React コンポーネント |
| `src/tests/web/TestEditorPanel.spec.tsx` | `TestEditorPanel` | React コンポーネント |
| `src/tests/web/TestCaseEditForm.spec.tsx` | `TestCaseEditForm` | React コンポーネント |
| `src/tests/web/TestCaseCreateForm.spec.tsx` | `TestCaseCreateForm` | React コンポーネント |

---

## 1. サーバーサイドテスト

### 1.1 TestFileService

`NospaceExecutionService` と同様に **DI + Fake オブジェクト** パターンを採用する。
ファイルシステム操作を抽象化し、テストでは Fake 実装を注入する。

#### DI インターフェース

```typescript
/** TestFileService が依存する fs 操作 */
interface TestFileSystem {
  readdir(dir: string): Promise<Dirent[]>;
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  stat(path: string): Promise<Stats>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  access(path: string): Promise<void>;
}
```

#### Fake 実装

```typescript
class FakeTestFileSystem implements TestFileSystem {
  /** 仮想ファイルシステム: パス → 内容 */
  private files = new Map<string, string>();
  /** 仮想ディレクトリ一覧 */
  private dirs = new Set<string>();

  // ヘルパー: テスト用にファイル・ディレクトリを事前設定
  addFile(path: string, content: string): void;
  addDirectory(path: string): void;
}
```

#### テストケース

| テストケース | 検証内容 |
|---|---|
| `getTree` - 基本 | passes/fails 構造を正しくツリーに変換 |
| `getTree` - ネスト | サブディレクトリ内のテストケースを再帰取得 |
| `getTree` - hasCheck | `.check.json` の有無を正しく判定 |
| `getTree` - ソート | ディレクトリ優先、名前昇順 |
| `getTree` - 空ディレクトリ | 空のディレクトリを正しく処理 |
| `getTestCase` - 正常 | `.ns` と `.check.json` を両方返す |
| `getTestCase` - check なし | `.check.json` が存在しない場合に `null` を返す |
| `getTestCase` - 存在しないパス | エラーをスロー |
| `updateTestCase` - ソース更新 | `.ns` ファイルを書き込み |
| `updateTestCase` - check 更新 | `.check.json` ファイルを書き込み |
| `createTestCase` - 正常 | 新規ファイル作成 |
| `createTestCase` - 既存パス | 既に存在する場合にエラー |
| `createTestCase` - サブディレクトリ自動作成 | ディレクトリが存在しない場合は再帰作成 |
| `validatePath` - パストラバーサル | `..` を含むパスを拒否 |
| `validatePath` - 絶対パス | `/` で始まるパスを拒否 |
| `validatePath` - テストディレクトリ外 | resolve 結果が testDir 外の場合拒否 |

### 1.2 TestController

`NospaceController` と同様に **Fake サービス** パターンを採用する。

#### Fake 実装

```typescript
class FakeTestFileService {
  getTreeResult: TestTreeNode[] = [];
  getTestCaseResult: TestCaseResponse | null = null;
  lastUpdatePath: string | null = null;
  lastUpdateData: TestCaseUpdateRequest | null = null;
  lastCreateData: TestCaseCreateRequest | null = null;
  shouldThrow: Error | null = null;

  async getTree() { return this.getTreeResult; }
  async getTestCase(path: string) { return this.getTestCaseResult; }
  async updateTestCase(path: string, data: TestCaseUpdateRequest) {
    this.lastUpdatePath = path;
    this.lastUpdateData = data;
  }
  async createTestCase(data: TestCaseCreateRequest) {
    this.lastCreateData = data;
  }
}
```

Express の `Request` / `Response` は簡易 Fake で対応する：

```typescript
function createFakeResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    statusCode: 200,
  };
  return res as unknown as Response;
}
```

#### テストケース

| テストケース | 検証内容 |
|---|---|
| `GET /api/tests` | ツリーレスポンスを正しく返す |
| `GET /api/tests/:path` - 正常 | テストケースデータを返す |
| `GET /api/tests/:path` - 404 | 存在しないパスで 404 を返す |
| `PUT /api/tests/:path` - 正常 | サービスの updateTestCase を呼び出す |
| `PUT /api/tests/:path` - バリデーション | source が空の場合に 400 |
| `POST /api/tests` - 正常 | サービスの createTestCase を呼び出す |
| `POST /api/tests` - 409 | 既存パスで 409 Conflict を返す |
| エラーハンドリング | サービスの例外を 500 に変換 |

---

## 2. フロントエンドテスト

### 2.1 TestApiClient

`fetch` API をモックして REST 通信をテストする。

```typescript
// グローバル fetch のモック
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});
```

#### テストケース

| テストケース | 検証内容 |
|---|---|
| `fetchTree` | GET /api/tests を呼び出し、レスポンスをパース |
| `fetchTestCase` | GET /api/tests/:path を呼び出し |
| `updateTestCase` | PUT /api/tests/:path を正しい body で呼び出し |
| `createTestCase` | POST /api/tests を正しい body で呼び出し |
| エラーレスポンス | HTTP エラーステータスで例外をスロー |

### 2.2 useTestTree Hook

`renderHook` + Jotai `<Provider>` + DI パターン。
`TestApiClient` を Hook に注入可能にし、テストでは Fake を渡す。

```typescript
function createTestWrapper() {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, wrapper };
}

const fakeClient = {
  fetchTree: jest.fn(),
};

const { store, wrapper } = createTestWrapper();
const { result } = renderHook(
  () => useTestTree(fakeClient),
  { wrapper }
);
```

#### テストケース

| テストケース | 検証内容 |
|---|---|
| `loadTree` | API を呼び、`testTreeAtom` にデータを設定 |
| `loadTree` - ローディング | 呼び出し中は `testTreeLoadingAtom` が `true` |
| `loadTree` - エラー | API エラー時に `testTreeErrorAtom` を設定 |
| `selectTest` | `selectedTestPathAtom` を更新 |

### 2.3 useTestEditor Hook

同様に `renderHook` + DI パターン。

#### テストケース

| テストケース | 検証内容 |
|---|---|
| `loadTestCase` | API を呼び、`editingTestCaseAtom` にデータを設定 |
| `updateSource` | `editingTestCaseAtom` の `source` を更新、dirty フラグを立てる |
| `updateCheck` | `editingTestCaseAtom` の `check` を更新、dirty フラグを立てる |
| `save` | API の updateTestCase を呼び出し、dirty フラグをリセット |
| `save` - 保存中状態 | 呼び出し中は `testEditorSavingAtom` が `true` |
| `create` | API の createTestCase を呼び出し |
| `startCreate`/`cancelCreate` | `testEditorCreateModeAtom` のトグル |

### 2.4 TestListPanel コンポーネント

`@testing-library/react` + Jotai `<Provider>` でレンダリング。

```typescript
function renderTestListPanel(options?: { tree?: TestTreeNode[] }) {
  const store = createStore();
  if (options?.tree) {
    store.set(testTreeAtom, options.tree);
  }
  const onCreateNew = jest.fn();
  const result = render(
    <Provider store={store}>
      <TestListPanel onCreateNew={onCreateNew} />
    </Provider>,
  );
  return { ...result, store, onCreateNew };
}
```

#### テストケース

| テストケース | 検証内容 |
|---|---|
| 初期表示 | ツリーが正しく描画される |
| ディレクトリ展開 | クリックで子要素が表示 |
| ディレクトリ折りたたみ | 再クリックで子要素が非表示 |
| テストケース選択 | クリックで `selectedTestPathAtom` が更新 |
| 選択状態ハイライト | 選択中のテストケースがハイライト表示 |
| hasCheck=false | check.json なしのテストが視覚マーク表示 |
| New Test ボタン | クリックで `onCreateNew` が呼ばれる |
| 空ツリー | ツリーが空の場合のメッセージ表示 |
| ローディング | `testTreeLoadingAtom=true` 時のローディング表示 |
| エラー | `testTreeErrorAtom` 設定時のエラー表示 |

### 2.5 TestCaseEditForm / TestCaseCreateForm コンポーネント

Props ベースのコンポーネントテスト。Jotai 不要。

#### TestCaseEditForm テストケース

| テストケース | 検証内容 |
|---|---|
| パス表示 | テストケースのパスが表示される |
| ソース表示 | ソースコードがテキストエリアに表示 |
| check 表示 | check.json がテキストエリアに表示 |
| check=null | check.json なしの場合の表示 |
| ソース編集 | テキスト変更で `onSourceChange` が呼ばれる |
| check 編集 | テキスト変更で `onCheckChange` が呼ばれる |
| Save ボタン - dirty | dirty=true のとき有効 |
| Save ボタン - clean | dirty=false のとき無効 |
| Save ボタン - saving | isSaving=true のとき無効 |
| Save クリック | `onSave` が呼ばれる |

#### TestCaseCreateForm テストケース

| テストケース | 検証内容 |
|---|---|
| カテゴリ一覧 | `categories` がセレクトボックスに表示 |
| ファイル名入力 | 入力が反映される |
| Create ボタン - 有効 | 必須フィールド入力済みで有効 |
| Create ボタン - 無効 | 必須フィールド未入力で無効 |
| Create クリック | `onSubmit` が正しいパラメータで呼ばれる |
| Cancel クリック | `onCancel` が呼ばれる |

### 2.6 TestEditorPanel コンポーネント

Jotai store を介して状態を制御する統合的なコンポーネントテスト。

#### テストケース

| テストケース | 検証内容 |
|---|---|
| 未選択状態 | 選択を促すメッセージが表示 |
| テストケース選択時 | TestCaseEditForm が表示 |
| 新規作成モード | TestCaseCreateForm が表示 |

---

## 3. テスト設計の原則

### 3.1 DI 優先

- `TestFileService` には `TestFileSystem` インターフェースを注入
- `useTestTree`、`useTestEditor` には `TestApiClient` を注入
- `jest.mock()` は使用しない（`__mocks__/` ディレクトリの自動モック以外）

### 3.2 Fake の実装方針

- Fake オブジェクトはテストファイル内に定義（他テストと共有しない）
- 各 Fake には検証用ヘルパー（`lastCallArgs`, `callCount` 等）を持たせる
- Fake の振る舞い変更はプロパティ設定で制御（`shouldThrow`, `result` 等）

### 3.3 テスト記述言語

- テスト名は **日本語** で記述（既存パターンに合わせる）
- `describe` / `it` の説明も日本語

```typescript
describe('TestFileService', () => {
  describe('getTree', () => {
    it('passes と fails のディレクトリ構造をツリーに変換する', async () => {
      // ...
    });
    it('check.json が存在しないテストケースの hasCheck が false になる', async () => {
      // ...
    });
  });
});
```

### 3.4 非同期テストの待機

- Hook テスト: `waitFor(() => expect(...))` で非同期完了を待機
- コンポーネントテスト: `await waitFor(() => ...)` で再レンダリングを待機
- `act()` でステート更新を明示的にラップ
