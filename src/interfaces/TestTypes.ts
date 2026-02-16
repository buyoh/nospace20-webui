/**
 * テストファイル管理機能の型定義
 */

/** テストツリーのノード型 */
export type TestTreeNodeType = 'directory' | 'test';

/** テストツリーのノード */
export interface TestTreeNode {
  /** ディレクトリまたはファイルの名前 */
  name: string;
  /** テストルートからの相対パス */
  path: string;
  /** ディレクトリ or テストケース */
  type: TestTreeNodeType;
  /** type=directory の場合のみ */
  children?: TestTreeNode[];
  /** type=test の場合: check.json が存在するか */
  hasCheck?: boolean;
}

/** GET /api/tests レスポンス */
export interface TestTreeResponse {
  tree: TestTreeNode[];
}

/** GET /api/tests/:path レスポンス */
export interface TestCaseResponse {
  /** テストルートからの相対パス（拡張子なし） */
  path: string;
  /** .ns ファイルの内容 */
  source: string;
  /** .check.json ファイルの内容（存在しない場合 null） */
  check: string | null;
}

/** PUT /api/tests/:path リクエスト */
export interface TestCaseUpdateRequest {
  /** .ns ファイルの内容 */
  source: string;
  /** .check.json ファイルの内容（null の場合は削除しない、空文字の場合はファイル削除） */
  check?: string;
}

/** PUT /api/tests/:path レスポンス */
export interface TestCaseUpdateResponse {
  success: boolean;
}

/** POST /api/tests リクエスト */
export interface TestCaseCreateRequest {
  /** テストルートからの相対パス（拡張子 `.ns` なし）。例: `passes/operators/arith_004` */
  path: string;
  /** .ns ファイルの内容 */
  source: string;
  /** .check.json ファイルの内容（省略可） */
  check?: string;
}

/** POST /api/tests レスポンス */
export interface TestCaseCreateResponse {
  success: boolean;
}
