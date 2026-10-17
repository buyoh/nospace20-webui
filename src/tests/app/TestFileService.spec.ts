import {
  TestFileService,
  TestFileSystem,
  MAX_PATH_DEPTH,
} from '../../app/Services/TestFileService';
import type { Dirent, Stats } from 'fs';

/** Fake Dirent implementation */
class FakeDirent implements Dirent {
  path: string = '';
  parentPath: string = '';

  constructor(
    public name: string,
    private isDir: boolean
  ) {}
  isDirectory(): boolean {
    return this.isDir;
  }
  isFile(): boolean {
    return !this.isDir;
  }
  isBlockDevice(): boolean {
    return false;
  }
  isCharacterDevice(): boolean {
    return false;
  }
  isSymbolicLink(): boolean {
    return false;
  }
  isFIFO(): boolean {
    return false;
  }
  isSocket(): boolean {
    return false;
  }
}

/** Fake Stats implementation */
class FakeStats implements Stats {
  dev = 0;
  ino = 0;
  mode = 0;
  nlink = 0;
  uid = 0;
  gid = 0;
  rdev = 0;
  size = 0;
  blksize = 0;
  blocks = 0;
  atimeMs = 0;
  mtimeMs = 0;
  ctimeMs = 0;
  birthtimeMs = 0;
  atime = new Date();
  mtime = new Date();
  ctime = new Date();
  birthtime = new Date();

  constructor(private isDir: boolean) {}

  isDirectory(): boolean {
    return this.isDir;
  }
  isFile(): boolean {
    return !this.isDir;
  }
  isBlockDevice(): boolean {
    return false;
  }
  isCharacterDevice(): boolean {
    return false;
  }
  isSymbolicLink(): boolean {
    return false;
  }
  isFIFO(): boolean {
    return false;
  }
  isSocket(): boolean {
    return false;
  }
}

/** Fake TestFileSystem implementation */
class FakeTestFileSystem implements TestFileSystem {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
    // Add parent directories
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      this.dirs.add(parts.slice(0, i).join('/'));
    }
  }

  addDirectory(path: string): void {
    this.dirs.add(path);
  }

  existsSync(path: string): boolean {
    const real = this.realpathSync(path);
    return this.files.has(real) || this.dirs.has(real);
  }

  readFileSync(path: string, _encoding: string): string {
    const content = this.files.get(this.realpathSync(path));
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  writeFileSync(path: string, data: string): void {
    if (this.failWriteFor && path.includes(this.failWriteFor)) {
      throw new Error('ENOSPC: no space left on device');
    }
    this.files.set(this.realpathSync(path), data);
  }

  /** テスト用: 保存されているファイルのパス一覧 */
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  unlinkSync(path: string): void {
    this.files.delete(path);
  }

  mkdirSync(path: string, options?: { recursive: boolean }): void {
    this.dirs.add(path);
    if (options?.recursive) {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        this.dirs.add(parts.slice(0, i).join('/'));
      }
    }
  }

  readdirSync(path: string, _options: { withFileTypes: true }): Dirent[] {
    const entries: Dirent[] = [];
    const prefix = path === '.' ? '' : path + '/';

    // Find directories
    for (const dir of this.dirs) {
      if (dir.startsWith(prefix)) {
        const relative = dir.slice(prefix.length);
        if (relative && !relative.includes('/')) {
          entries.push(new FakeDirent(relative, true));
        }
      }
    }

    // Find files
    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const relative = file.slice(prefix.length);
        if (relative && !relative.includes('/')) {
          const fileName = relative.split('/').pop() || relative;
          entries.push(new FakeDirent(fileName, false));
        }
      }
    }

    return entries;
  }

  renameSync(from: string, to: string): void {
    const content = this.files.get(from);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, rename '${from}'`);
    }
    this.files.delete(from);
    this.files.set(to, content);
  }

  /** シンボリックリンクの対応表。link パスの実パスを target に解決する */
  private links = new Map<string, string>();

  addSymlink(linkPath: string, targetPath: string): void {
    this.links.set(linkPath, targetPath);
    this.dirs.add(linkPath);
  }

  /** 書き込みを失敗させたいパスの接尾辞 */
  failWriteFor: string | null = null;

  realpathSync(path: string): string {
    for (const [link, target] of this.links) {
      if (path === link || path.startsWith(link + '/')) {
        return target + path.slice(link.length);
      }
    }
    return path;
  }

  statSync(path: string): Stats {
    if (this.dirs.has(path)) {
      return new FakeStats(true);
    }
    if (this.files.has(path)) {
      return new FakeStats(false);
    }
    throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
  }
}

describe('TestFileService', () => {
  describe('getTree', () => {
    it('should return tree structure', async () => {
      const fs = new FakeTestFileSystem();
      fs.addDirectory('/test/passes');
      fs.addDirectory('/test/fails');
      fs.addFile('/test/passes/test1.ns', 'code1');
      fs.addFile('/test/passes/test1.check.json', '{}');
      fs.addFile('/test/passes/test2.ns', 'code2');

      const service = new TestFileService('/test', fs);
      const tree = await service.getTree();

      expect(tree).toHaveLength(2);
      expect(tree[0]).toMatchObject({
        name: 'fails',
        type: 'directory',
        path: 'fails',
      });
      expect(tree[1]).toMatchObject({
        name: 'passes',
        type: 'directory',
        path: 'passes',
      });
      expect(tree[1].children).toHaveLength(2);
      expect(tree[1].children?.[0]).toMatchObject({
        name: 'test1',
        type: 'test',
        path: 'passes/test1',
        hasCheck: true,
      });
      expect(tree[1].children?.[1]).toMatchObject({
        name: 'test2',
        type: 'test',
        path: 'passes/test2',
        hasCheck: false,
      });
    });

    it('should handle nested directories', async () => {
      const fs = new FakeTestFileSystem();
      fs.addDirectory('/test/passes');
      fs.addDirectory('/test/passes/operators');
      fs.addFile('/test/passes/operators/arith_001.ns', 'code');
      fs.addFile('/test/passes/operators/arith_001.check.json', '{}');

      const service = new TestFileService('/test', fs);
      const tree = await service.getTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children?.[0]).toMatchObject({
        name: 'operators',
        type: 'directory',
        path: 'passes/operators',
      });
      expect(tree[0].children?.[0].children).toHaveLength(1);
      expect(tree[0].children?.[0].children?.[0]).toMatchObject({
        name: 'arith_001',
        type: 'test',
        path: 'passes/operators/arith_001',
        hasCheck: true,
      });
    });

    it('should sort directories first, then files', async () => {
      const fs = new FakeTestFileSystem();
      fs.addDirectory('/test/dir2');
      fs.addDirectory('/test/dir1');
      fs.addFile('/test/file2.ns', 'code2');
      fs.addFile('/test/file1.ns', 'code1');

      const service = new TestFileService('/test', fs);
      const tree = await service.getTree();

      expect(tree).toHaveLength(4);
      expect(tree[0].name).toBe('dir1');
      expect(tree[1].name).toBe('dir2');
      expect(tree[2].name).toBe('file1');
      expect(tree[3].name).toBe('file2');
    });

    it('should handle empty directory', async () => {
      const fs = new FakeTestFileSystem();
      fs.addDirectory('/test/empty');

      const service = new TestFileService('/test', fs);
      const tree = await service.getTree();

      expect(tree).toHaveLength(1);
      expect(tree[0]).toMatchObject({
        name: 'empty',
        type: 'directory',
        path: 'empty',
        children: [],
      });
    });
  });

  describe('getTestCase', () => {
    it('should return test case with source and check', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'source code');
      fs.addFile('/test/passes/test1.check.json', '{"trace_hit_counts": [1]}');

      const service = new TestFileService('/test', fs);
      const result = await service.getTestCase('passes/test1');

      expect(result).toEqual({
        path: 'passes/test1',
        source: 'source code',
        check: '{"trace_hit_counts": [1]}',
      });
    });

    it('should return null for check when file does not exist', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'source code');

      const service = new TestFileService('/test', fs);
      const result = await service.getTestCase('passes/test1');

      expect(result).toEqual({
        path: 'passes/test1',
        source: 'source code',
        check: null,
      });
    });

    it('should throw error when test file does not exist', async () => {
      const fs = new FakeTestFileSystem();

      const service = new TestFileService('/test', fs);

      await expect(service.getTestCase('passes/nonexistent')).rejects.toThrow(
        'Test file not found: passes/nonexistent'
      );
    });
  });

  describe('updateTestCase', () => {
    it('should update source file', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'old source');
      fs.addFile('/test/passes/test1.check.json', 'old check');

      const service = new TestFileService('/test', fs);
      await service.updateTestCase('passes/test1', {
        source: 'new source',
      });

      expect(fs.readFileSync('/test/passes/test1.ns', 'utf-8')).toBe(
        'new source'
      );
    });

    it('should update check file', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'source');
      fs.addFile('/test/passes/test1.check.json', 'old check');

      const service = new TestFileService('/test', fs);
      await service.updateTestCase('passes/test1', {
        source: 'source',
        check: 'new check',
      });

      expect(fs.readFileSync('/test/passes/test1.check.json', 'utf-8')).toBe(
        'new check'
      );
    });

    it('should delete check file when check is empty string', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'source');
      fs.addFile('/test/passes/test1.check.json', 'check');

      const service = new TestFileService('/test', fs);
      await service.updateTestCase('passes/test1', {
        source: 'source',
        check: '',
      });

      expect(fs.existsSync('/test/passes/test1.check.json')).toBe(false);
    });

    it('should throw error when test file does not exist', async () => {
      const fs = new FakeTestFileSystem();

      const service = new TestFileService('/test', fs);

      await expect(
        service.updateTestCase('passes/nonexistent', { source: 'source' })
      ).rejects.toThrow('Test file not found: passes/nonexistent');
    });
  });

  describe('createTestCase', () => {
    it('should create new test case', async () => {
      const fs = new FakeTestFileSystem();
      fs.addDirectory('/test/passes');

      const service = new TestFileService('/test', fs);
      await service.createTestCase({
        path: 'passes/test1',
        source: 'source code',
        check: '{"trace_hit_counts": [1]}',
      });

      expect(fs.readFileSync('/test/passes/test1.ns', 'utf-8')).toBe(
        'source code'
      );
      expect(fs.readFileSync('/test/passes/test1.check.json', 'utf-8')).toBe(
        '{"trace_hit_counts": [1]}'
      );
    });

    it('should create parent directory if it does not exist', async () => {
      const fs = new FakeTestFileSystem();

      const service = new TestFileService('/test', fs);
      await service.createTestCase({
        path: 'passes/operators/test1',
        source: 'source code',
      });

      expect(fs.existsSync('/test/passes/operators')).toBe(true);
      expect(fs.readFileSync('/test/passes/operators/test1.ns', 'utf-8')).toBe(
        'source code'
      );
    });

    it('should not create check file when check is empty', async () => {
      const fs = new FakeTestFileSystem();
      fs.addDirectory('/test/passes');

      const service = new TestFileService('/test', fs);
      await service.createTestCase({
        path: 'passes/test1',
        source: 'source code',
        check: '',
      });

      expect(fs.existsSync('/test/passes/test1.ns')).toBe(true);
      expect(fs.existsSync('/test/passes/test1.check.json')).toBe(false);
    });

    it('should throw error when test file already exists', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'existing');

      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({
          path: 'passes/test1',
          source: 'new source',
        })
      ).rejects.toThrow('Test file already exists: passes/test1');
    });
  });

  describe('validatePath', () => {
    it('should reject path with .. segments', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(
        service.getTestCase('passes/../../../etc/passwd')
      ).rejects.toThrow('Path traversal is not allowed');
    });

    it('should reject absolute paths', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(service.getTestCase('/etc/passwd')).rejects.toThrow(
        'Absolute paths are not allowed'
      );
    });
  });

  describe('入力の検証（書き込み前）', () => {
    it('BUG: source が文字列でない場合は、何も書き込まずにエラーにする', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'old source');
      const service = new TestFileService('/test', fs);

      await expect(
        service.updateTestCase('passes/test1', { source: 123 as any })
      ).rejects.toThrow('Invalid request: source must be a string');

      expect(await service.getTestCase('passes/test1')).toMatchObject({
        source: 'old source',
      });
    });

    it('BUG: check が文字列でない場合は、.ns も更新せずにエラーにする（中途半端に更新された状態を残さない）', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'old source');
      const service = new TestFileService('/test', fs);

      await expect(
        service.updateTestCase('passes/test1', {
          source: 'new source',
          check: { x: 1 } as any,
        })
      ).rejects.toThrow('Invalid request: check must be a string');

      expect(fs.readFileSync('/test/passes/test1.ns', 'utf-8')).toBe(
        'old source'
      );
    });

    it('作成時も source / check の型を検証する', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({ path: 'a/b', source: null as any })
      ).rejects.toThrow('Invalid request');
      await expect(
        service.createTestCase({ path: 'a/b', source: 's', check: 5 as any })
      ).rejects.toThrow('Invalid request');
      expect(fs.listFiles()).toEqual([]);
    });
  });

  describe('原子的な更新', () => {
    it('BUG: 書き込みが失敗しても既存ファイルは壊れず、一時ファイルも残らない', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'old source');
      const service = new TestFileService('/test', fs);
      fs.failWriteFor = '.tmp-';

      await expect(
        service.updateTestCase('passes/test1', { source: 'new source' })
      ).rejects.toThrow('ENOSPC');

      expect(fs.readFileSync('/test/passes/test1.ns', 'utf-8')).toBe(
        'old source'
      );
      expect(fs.listFiles().filter((f) => f.includes('.tmp-'))).toEqual([]);
    });

    it('成功時は一時ファイルが rename で置き換わり、残らない', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/passes/test1.ns', 'old source');
      const service = new TestFileService('/test', fs);

      await service.updateTestCase('passes/test1', {
        source: 'new source',
        check: '{"a":1}',
      });

      expect(fs.readFileSync('/test/passes/test1.ns', 'utf-8')).toBe(
        'new source'
      );
      expect(fs.readFileSync('/test/passes/test1.check.json', 'utf-8')).toBe(
        '{"a":1}'
      );
      expect(fs.listFiles().filter((f) => f.includes('.tmp-'))).toEqual([]);
    });
  });

  describe('パスの深さと要素', () => {
    const deep = (levels: number) =>
      Array.from({ length: levels }, (_, i) => `d${i}`).join('/');

    it('許可される最大の深さまでは作成できる', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({ path: deep(MAX_PATH_DEPTH), source: 's' })
      ).resolves.toBeUndefined();
    });

    it('深さの上限を超えるパスは作成を拒否し、ディレクトリを作らない', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({ path: deep(MAX_PATH_DEPTH + 1), source: 's' })
      ).rejects.toThrow('Invalid path: too many levels');
      expect(fs.listFiles()).toEqual([]);
    });

    it('`a..b` のような `..` を含む正当な名前は拒否しない', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({ path: 'passes/a..b', source: 's' })
      ).resolves.toBeUndefined();
    });

    it('`..` で始まるだけの名前（`..x`）は拒否しない', async () => {
      const fs = new FakeTestFileSystem();
      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({ path: '..x/a', source: 's' })
      ).resolves.toBeUndefined();
    });

    it.each(['passes//x', 'passes/./x', 'passes/x\\y', ''])(
      '空・不正な要素を含むパス（%j）は拒否する',
      async (path) => {
        const fs = new FakeTestFileSystem();
        const service = new TestFileService('/test', fs);

        await expect(service.getTestCase(path)).rejects.toThrow('Invalid path');
      }
    );
  });

  describe('シンボリックリンク経由の脱出', () => {
    it('BUG: testDir 内のシンボリックリンクが外を指していても、読み取りを拒否する', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/outside/secret.ns', 'secret');
      fs.addSymlink('/test/link', '/outside');
      const service = new TestFileService('/test', fs);

      await expect(service.getTestCase('link/secret')).rejects.toThrow(
        'outside test directory'
      );
    });

    it('シンボリックリンク経由で外へ作成・更新することを拒否する', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/outside/x.ns', 'old');
      fs.addSymlink('/test/link', '/outside');
      const service = new TestFileService('/test', fs);

      await expect(
        service.createTestCase({ path: 'link/new', source: 's' })
      ).rejects.toThrow('outside test directory');
      await expect(
        service.updateTestCase('link/x', { source: 'hacked' })
      ).rejects.toThrow('outside test directory');
      expect(fs.readFileSync('/outside/x.ns', 'utf-8')).toBe('old');
    });

    it('testDir 内を指すシンボリックリンクは許可する', async () => {
      const fs = new FakeTestFileSystem();
      fs.addFile('/test/real/t.ns', 'ok');
      fs.addSymlink('/test/alias', '/test/real');
      const service = new TestFileService('/test', fs);

      await expect(service.getTestCase('alias/t')).resolves.toMatchObject({
        source: 'ok',
      });
    });
  });
});
