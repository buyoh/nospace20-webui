import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
  statSync,
  renameSync,
  realpathSync,
  Dirent,
  Stats,
} from 'fs';
import { join, resolve, relative, sep, dirname, basename } from 'path';
import { MAX_TEST_PATH_DEPTH } from '../../interfaces/TestTypes';
import type {
  TestTreeNode,
  TestCaseResponse,
  TestCaseUpdateRequest,
  TestCaseCreateRequest,
} from '../../interfaces/TestTypes';

/** ファイルシステム操作の抽象 */
export interface TestFileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string): void;
  unlinkSync(path: string): void;
  mkdirSync(path: string, options?: { recursive: boolean }): void;
  readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  statSync(path: string): Stats;
  renameSync(from: string, to: string): void;
  /** シンボリックリンクを解決した実パスを返す（存在するパスのみ） */
  realpathSync(path: string): string;
}

/** テストケースのパスとして許可する深さ（ディレクトリ + ファイル名の要素数） */
export const MAX_PATH_DEPTH = MAX_TEST_PATH_DEPTH;
/** パスの 1 要素として許可する最大文字数 */
const MAX_SEGMENT_LENGTH = 100;

/** デフォルトのFileSystem実装 */
const defaultFileSystem: TestFileSystem = {
  existsSync,
  readFileSync: (path: string, encoding: string) =>
    readFileSync(path, { encoding: encoding as BufferEncoding }),
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync: (path: string, options: { withFileTypes: true }) =>
    readdirSync(path, options),
  statSync,
  renameSync,
  realpathSync: (path: string) => realpathSync(path),
};

/**
 * テストファイルの読み取り・書き込み・作成を行うサービス
 */
export class TestFileService {
  private tmpCounter = 0;

  constructor(
    private readonly testDir: string,
    private readonly fs: TestFileSystem = defaultFileSystem
  ) {}

  /**
   * テストファイルのツリー構造を返す
   */
  async getTree(): Promise<TestTreeNode[]> {
    const absoluteTestDir = resolve(this.testDir);
    return this.buildTree(absoluteTestDir, '');
  }

  /**
   * 指定されたテストケースのソースと期待結果を読み取る
   */
  async getTestCase(relativePath: string): Promise<TestCaseResponse> {
    const safePath = this.validatePath(relativePath);
    const absoluteTestDir = resolve(this.testDir);
    const nsPath = join(absoluteTestDir, `${safePath}.ns`);
    const checkPath = join(absoluteTestDir, `${safePath}.check.json`);

    if (!this.fs.existsSync(nsPath)) {
      throw new Error(`Test file not found: ${relativePath}`);
    }
    this.assertInsideRealRoot(nsPath);

    const source = this.fs.readFileSync(nsPath, 'utf-8');
    const check = this.fs.existsSync(checkPath)
      ? this.fs.readFileSync(checkPath, 'utf-8')
      : null;

    return {
      path: relativePath,
      source,
      check,
    };
  }

  /**
   * テストケースを更新する
   */
  async updateTestCase(
    relativePath: string,
    data: TestCaseUpdateRequest
  ): Promise<void> {
    const safePath = this.validatePath(relativePath);
    // 何も書き込む前に入力を検証する（検証エラーで .ns だけ更新された状態を残さない）
    this.validateContent(data);
    const absoluteTestDir = resolve(this.testDir);
    const nsPath = join(absoluteTestDir, `${safePath}.ns`);
    const checkPath = join(absoluteTestDir, `${safePath}.check.json`);

    if (!this.fs.existsSync(nsPath)) {
      throw new Error(`Test file not found: ${relativePath}`);
    }
    this.assertInsideRealRoot(nsPath);
    this.assertInsideRealRoot(checkPath);

    // Update .ns file
    this.writeFileAtomic(nsPath, data.source);

    // Update .check.json file
    if (data.check !== undefined) {
      if (data.check === '') {
        // Delete check file
        if (this.fs.existsSync(checkPath)) {
          this.fs.unlinkSync(checkPath);
        }
      } else {
        this.writeFileAtomic(checkPath, data.check);
      }
    }
  }

  /**
   * 新しいテストケースを作成する
   */
  async createTestCase(data: TestCaseCreateRequest): Promise<void> {
    const safePath = this.validatePath(data.path);
    this.validateContent(data);
    const absoluteTestDir = resolve(this.testDir);
    const nsPath = join(absoluteTestDir, `${safePath}.ns`);
    const checkPath = join(absoluteTestDir, `${safePath}.check.json`);

    if (this.fs.existsSync(nsPath)) {
      throw new Error(`Test file already exists: ${data.path}`);
    }

    // Create parent directory if it doesn't exist
    const parentDir = join(
      absoluteTestDir,
      safePath.split('/').slice(0, -1).join('/')
    );
    // 作成前に、既存の祖先ディレクトリ（シンボリックリンク）経由で testDir の外に出ないことを確認する
    this.assertInsideRealRoot(parentDir);
    if (!this.fs.existsSync(parentDir)) {
      this.fs.mkdirSync(parentDir, { recursive: true });
    }

    // Create .ns file
    this.writeFileAtomic(nsPath, data.source);

    // Create .check.json file if provided
    if (data.check !== undefined && data.check !== '') {
      this.writeFileAtomic(checkPath, data.check);
    }
  }

  /**
   * ディレクトリを再帰的にスキャンしてツリーを構築する
   */
  private buildTree(absoluteDir: string, relativePath: string): TestTreeNode[] {
    const entries = this.fs.readdirSync(absoluteDir, { withFileTypes: true });
    const nodes: TestTreeNode[] = [];

    // Collect directories and .ns files
    const dirs: Dirent[] = [];
    const nsFiles: { name: string; baseName: string }[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(entry);
      } else if (entry.name.endsWith('.ns')) {
        const baseName = entry.name.slice(0, -3); // Remove .ns extension
        nsFiles.push({ name: entry.name, baseName });
      }
    }

    // Sort directories and files
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    nsFiles.sort((a, b) => a.baseName.localeCompare(b.baseName));

    // Add directories
    for (const dir of dirs) {
      const dirRelativePath = relativePath
        ? `${relativePath}/${dir.name}`
        : dir.name;
      const dirAbsolutePath = join(absoluteDir, dir.name);
      const children = this.buildTree(dirAbsolutePath, dirRelativePath);

      nodes.push({
        name: dir.name,
        path: dirRelativePath,
        type: 'directory',
        children,
      });
    }

    // Add test files
    for (const { baseName } of nsFiles) {
      const testRelativePath = relativePath
        ? `${relativePath}/${baseName}`
        : baseName;
      const checkPath = join(absoluteDir, `${baseName}.check.json`);
      const hasCheck = this.fs.existsSync(checkPath);

      nodes.push({
        name: baseName,
        path: testRelativePath,
        type: 'test',
        hasCheck,
      });
    }

    return nodes;
  }

  /**
   * ファイルを一時ファイルに書いてから rename で置き換える。
   * 書き込みの途中で失敗しても、既存のファイルが壊れた（途中まで書かれた）状態にならない。
   */
  private writeFileAtomic(path: string, data: string): void {
    const tmpPath = `${path}.tmp-${process.pid}-${++this.tmpCounter}`;
    try {
      this.fs.writeFileSync(tmpPath, data);
      this.fs.renameSync(tmpPath, path);
    } catch (error) {
      try {
        if (this.fs.existsSync(tmpPath)) this.fs.unlinkSync(tmpPath);
      } catch {
        // 一時ファイルの削除失敗は元のエラーを優先して無視する
      }
      throw error;
    }
  }

  /**
   * リクエスト本文の型を検証する。
   *
   * BUG FIX: source / check の型を検証していなかったため、文字列以外が来ると .ns を書き込んだ後に
   * check の書き込みで失敗し、中途半端に更新された状態が残っていた。
   * 解決策として、何も書き込む前に型を検証する。
   */
  private validateContent(data: { source?: unknown; check?: unknown }): void {
    if (typeof data?.source !== 'string') {
      throw new Error('Invalid request: source must be a string');
    }
    if (data.check !== undefined && typeof data.check !== 'string') {
      throw new Error('Invalid request: check must be a string');
    }
  }

  /**
   * パスの安全性を検証する（パストラバーサル防止・深さの制限）
   */
  private validatePath(relativePath: string): string {
    if (typeof relativePath !== 'string' || relativePath === '') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    // Reject absolute paths
    if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
      throw new Error('Absolute paths are not allowed');
    }

    // 要素ごとに検証する。`a..b` のような正当な名前を拒否せず、`..` 要素のみを拒否する
    const segments = relativePath.split('/');
    if (segments.includes('..')) {
      throw new Error('Path traversal is not allowed');
    }
    if (
      segments.some(
        (seg) =>
          seg === '' ||
          seg === '.' ||
          seg.length > MAX_SEGMENT_LENGTH ||
          seg.includes('\\') ||
          seg.includes('\0')
      )
    ) {
      throw new Error('Invalid path: contains an empty or invalid segment');
    }
    if (segments.length > MAX_PATH_DEPTH) {
      throw new Error(`Invalid path: too many levels (max ${MAX_PATH_DEPTH})`);
    }

    // Resolve and ensure the path is within testDir
    const absoluteTestDir = resolve(this.testDir);
    const absolutePath = resolve(absoluteTestDir, relativePath);

    // Ensure the resolved path starts with testDir
    const relativeToTestDir = relative(absoluteTestDir, absolutePath);
    // `..foo` のような、`..` で始まるだけの正当な名前を拒否しないよう、要素として厳密に判定する
    if (
      relativeToTestDir === '..' ||
      relativeToTestDir.startsWith('..' + sep)
    ) {
      throw new Error('Path is outside test directory');
    }

    return relativePath;
  }

  /**
   * 実パス（シンボリックリンク解決後）が testDir の実パス配下にあることを確認する。
   * パスの字句的な検証だけでは、testDir 内のシンボリックリンク経由で外へ出られてしまうため。
   * まだ存在しないパスは、存在する最も深い祖先の実パスに残りの要素を連結して判定する。
   */
  private assertInsideRealRoot(path: string): void {
    const realRoot = this.realResolve(resolve(this.testDir));
    const realTarget = this.realResolve(path);
    if (realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) {
      throw new Error('Path is outside test directory');
    }
  }

  private realResolve(path: string): string {
    let existing = path;
    const rest: string[] = [];
    while (!this.fs.existsSync(existing)) {
      const parent = dirname(existing);
      if (parent === existing) break;
      rest.unshift(basename(existing));
      existing = parent;
    }
    return join(this.fs.realpathSync(existing), ...rest);
  }
}
