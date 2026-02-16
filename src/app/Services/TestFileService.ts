import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
  statSync,
  Dirent,
  Stats,
} from 'fs';
import { join, resolve, relative, sep } from 'path';
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
}

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
};

/**
 * テストファイルの読み取り・書き込み・作成を行うサービス
 */
export class TestFileService {
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
    const absoluteTestDir = resolve(this.testDir);
    const nsPath = join(absoluteTestDir, `${safePath}.ns`);
    const checkPath = join(absoluteTestDir, `${safePath}.check.json`);

    if (!this.fs.existsSync(nsPath)) {
      throw new Error(`Test file not found: ${relativePath}`);
    }

    // Update .ns file
    this.fs.writeFileSync(nsPath, data.source);

    // Update .check.json file
    if (data.check !== undefined) {
      if (data.check === '') {
        // Delete check file
        if (this.fs.existsSync(checkPath)) {
          this.fs.unlinkSync(checkPath);
        }
      } else {
        this.fs.writeFileSync(checkPath, data.check);
      }
    }
  }

  /**
   * 新しいテストケースを作成する
   */
  async createTestCase(data: TestCaseCreateRequest): Promise<void> {
    const safePath = this.validatePath(data.path);
    const absoluteTestDir = resolve(this.testDir);
    const nsPath = join(absoluteTestDir, `${safePath}.ns`);
    const checkPath = join(absoluteTestDir, `${safePath}.check.json`);

    if (this.fs.existsSync(nsPath)) {
      throw new Error(`Test file already exists: ${data.path}`);
    }

    // Create parent directory if it doesn't exist
    const parentDir = join(absoluteTestDir, safePath.split('/').slice(0, -1).join('/'));
    if (!this.fs.existsSync(parentDir)) {
      this.fs.mkdirSync(parentDir, { recursive: true });
    }

    // Create .ns file
    this.fs.writeFileSync(nsPath, data.source);

    // Create .check.json file if provided
    if (data.check !== undefined && data.check !== '') {
      this.fs.writeFileSync(checkPath, data.check);
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
      const dirRelativePath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
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
      const testRelativePath = relativePath ? `${relativePath}/${baseName}` : baseName;
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
   * パスの安全性を検証する（パストラバーサル防止）
   */
  private validatePath(relativePath: string): string {
    // Reject absolute paths
    if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
      throw new Error('Absolute paths are not allowed');
    }

    // Reject paths with .. segments
    if (relativePath.includes('..')) {
      throw new Error('Path traversal is not allowed');
    }

    // Resolve and ensure the path is within testDir
    const absoluteTestDir = resolve(this.testDir);
    const absolutePath = resolve(absoluteTestDir, relativePath);

    // Ensure the resolved path starts with testDir
    const relativeToTestDir = relative(absoluteTestDir, absolutePath);
    if (
      relativeToTestDir.startsWith('..') ||
      relativeToTestDir.startsWith(sep + '..')
    ) {
      throw new Error('Path is outside test directory');
    }

    return relativePath;
  }
}
