import { TestFileService, TestFileSystem } from '../../app/Services/TestFileService';
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
    return this.files.has(path) || this.dirs.has(path);
  }

  readFileSync(path: string, encoding: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  writeFileSync(path: string, data: string): void {
    this.files.set(path, data);
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

  readdirSync(path: string, options: { withFileTypes: true }): Dirent[] {
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
});
