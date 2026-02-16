# テスト編集機能: サーバーサイド API

## 概要

テストファイルの一覧取得・読み取り・書き込み・作成を行う REST API をサーバーサイドに新設する。

## 環境変数

### `.env.example` への追加

```dotenv
# テストファイルディレクトリのパス
NOSPACE_TEST_DIR=./resources/tests
```

### `src/app/Config.ts` への追加

`parseAppConfig()` に以下を追加：

```typescript
nospaceTestDir: process.env.NOSPACE_TEST_DIR || './resources/tests',
```

### `src/interfaces/EnvConfig.ts` への追加

```typescript
NOSPACE_TEST_DIR?: string;
```

## REST API 設計

### 共通

- ベースパス: `/api/tests`
- Content-Type: `application/json`
- テストディレクトリより上位へのパストラバーサルを防止する（`..` を含むパスを拒否）

### エンドポイント

#### `GET /api/tests`

テストファイルのツリー構造を返す。

**レスポンス:**
```typescript
interface TestTreeResponse {
  tree: TestTreeNode[];
}

interface TestTreeNode {
  /** ディレクトリまたはファイルの名前 */
  name: string;
  /** テストルートからの相対パス */
  path: string;
  /** ディレクトリ or テストケース */
  type: 'directory' | 'test';
  /** type=directory の場合のみ */
  children?: TestTreeNode[];
  /** type=test の場合: check.json が存在するか */
  hasCheck?: boolean;
}
```

**実装ノート:**
- `.ns` ファイルをベースにテストケースを検出
- 対応する `.check.json` の存在を `hasCheck` で示す
- ディレクトリは再帰的に走査
- ソートはディレクトリ優先、名前昇順

#### `GET /api/tests/:path`

指定パスのテストケースのソースコードと期待結果を返す。

**パラメータ:**
- `path`: テストルートからの相対パス（拡張子 `.ns` なし）。例: `passes/operators/arith_001`

**レスポンス:**
```typescript
interface TestCaseResponse {
  /** テストルートからの相対パス（拡張子なし） */
  path: string;
  /** .ns ファイルの内容 */
  source: string;
  /** .check.json ファイルの内容（存在しない場合 null） */
  check: string | null;
}
```

#### `PUT /api/tests/:path`

テストケースのソースコードと期待結果を更新する。

**パラメータ:**
- `path`: テストルートからの相対パス（拡張子 `.ns` なし）

**リクエストボディ:**
```typescript
interface TestCaseUpdateRequest {
  /** .ns ファイルの内容 */
  source: string;
  /** .check.json ファイルの内容（null の場合は削除しない、空文字の場合はファイル削除） */
  check?: string;
}
```

**レスポンス:**
```typescript
interface TestCaseUpdateResponse {
  success: boolean;
}
```

#### `POST /api/tests`

新しいテストケースを作成する。

**リクエストボディ:**
```typescript
interface TestCaseCreateRequest {
  /** テストルートからの相対パス（拡張子 `.ns` なし）。例: `passes/operators/arith_004` */
  path: string;
  /** .ns ファイルの内容 */
  source: string;
  /** .check.json ファイルの内容（省略可） */
  check?: string;
}
```

**レスポンス:**
```typescript
interface TestCaseCreateResponse {
  success: boolean;
}
```

**エラーケース:**
- 同名ファイルが既に存在する場合: `409 Conflict`

## ファイル構成

### 新規ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/Routes/TestRoutes.ts` | REST API ルート定義 |
| `src/app/Controllers/TestController.ts` | リクエスト処理 |
| `src/app/Services/TestFileService.ts` | ファイル操作ロジック |
| `src/interfaces/TestTypes.ts` | 共通型定義 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/Config.ts` | `nospaceTestDir` 追加 |
| `src/app/Web/Express.ts` | REST API ルートのバインド追加 |
| `src/interfaces/EnvConfig.ts` | `NOSPACE_TEST_DIR` 追加 |
| `.env.example` | `NOSPACE_TEST_DIR` 追加 |

## `TestFileService` の設計

```typescript
class TestFileService {
  constructor(private readonly testDir: string);

  /** テストファイルのツリーを返す */
  async getTree(): Promise<TestTreeNode[]>;

  /** テストケースのソースと期待結果を読み取る */
  async getTestCase(relativePath: string): Promise<TestCaseResponse>;

  /** テストケースを更新する */
  async updateTestCase(relativePath: string, data: TestCaseUpdateRequest): Promise<void>;

  /** 新しいテストケースを作成する */
  async createTestCase(data: TestCaseCreateRequest): Promise<void>;

  /** パスの安全性を検証する（パストラバーサル防止） */
  private validatePath(relativePath: string): string;
}
```

### パス安全性検証

- `..` セグメントを含むパスを拒否
- `path.resolve()` 結果がテストディレクトリ配下であることを確認
- 絶対パスの入力を拒否

## `TestController` の設計

```typescript
class TestController {
  constructor(private readonly service: TestFileService);

  /** GET /api/tests */
  handleGetTree(req: Request, res: Response): Promise<void>;

  /** GET /api/tests/:path(*) */
  handleGetTestCase(req: Request, res: Response): Promise<void>;

  /** PUT /api/tests/:path(*) */
  handleUpdateTestCase(req: Request, res: Response): Promise<void>;

  /** POST /api/tests */
  handleCreateTestCase(req: Request, res: Response): Promise<void>;
}
```

## `TestRoutes` の設計

```typescript
export function bindTestRoutes(app: Express, testDir: string): void {
  const service = new TestFileService(testDir);
  const controller = new TestController(service);

  app.get('/api/tests', (req, res) => controller.handleGetTree(req, res));
  app.get('/api/tests/*', (req, res) => controller.handleGetTestCase(req, res));
  app.put('/api/tests/*', (req, res) => controller.handleUpdateTestCase(req, res));
  app.post('/api/tests', (req, res) => controller.handleCreateTestCase(req, res));
}
```

## Express.ts の変更

`setupExpressServer` に `testDir` パラメータ（またはConfig参照）を追加し、
`APPLICATION_FLAVOR=websocket` の場合のみ REST API ルートをバインドする。

```typescript
// flavor=websocket の場合のみ
if (config.nospaceTestDir) {
  bindTestRoutes(appExpress, config.nospaceTestDir);
}
```

## セキュリティ考慮

- パストラバーサル攻撃の防止
- テストディレクトリ外へのファイル操作禁止
- Express のリクエストボディサイズ制限（デフォルトの JSON パーサー制限で十分）
