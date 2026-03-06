import { createStore } from 'jotai';
import { operationModeAtom } from '../../web/stores/testEditorAtom';
import type { OperationMode } from '../../web/stores/testEditorAtom';

describe('testEditorAtom', () => {
  describe('operationModeAtom', () => {
    it('初期値が "compile" であること', () => {
      const store = createStore();
      expect(store.get(operationModeAtom)).toBe('compile');
    });

    it('"compile" に設定できること', () => {
      const store = createStore();
      store.set(operationModeAtom, 'compile');
      expect(store.get(operationModeAtom)).toBe('compile');
    });

    it('"run" に設定できること', () => {
      const store = createStore();
      store.set(operationModeAtom, 'run');
      expect(store.get(operationModeAtom)).toBe('run');
    });

    it('"run-direct" に設定できること', () => {
      const store = createStore();
      store.set(operationModeAtom, 'run-direct');
      expect(store.get(operationModeAtom)).toBe('run-direct');
    });

    it('"test-editor" に設定できること', () => {
      const store = createStore();
      store.set(operationModeAtom, 'test-editor');
      expect(store.get(operationModeAtom)).toBe('test-editor');
    });
  });

  describe('OperationMode 型', () => {
    it('有効な値が代入可能であること（型チェック）', () => {
      // 型として 'compile' | 'run' | 'run-direct' | 'test-editor' が有効
      const modes: OperationMode[] = [
        'compile',
        'run',
        'run-direct',
        'test-editor',
      ];
      expect(modes).toHaveLength(4);
      expect(modes).toContain('compile');
      expect(modes).toContain('run');
      expect(modes).toContain('run-direct');
      expect(modes).toContain('test-editor');
    });
  });
});
