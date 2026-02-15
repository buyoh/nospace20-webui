import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import {
  useNospaceExecution,
  type BackendFactory,
} from '../../web/hooks/useNospaceExecution';
import { sourceCodeAtom } from '../../web/stores/editorAtom';
import { executionOptionsAtom, compileOptionsAtom } from '../../web/stores/optionsAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../../web/stores/executionAtom';
import { flavorAtom } from '../../web/stores/flavorAtom';
import type { ExecutionBackend } from '../../web/services/ExecutionBackend';
import type { OutputEntry, ExecutionStatus } from '../../interfaces/NospaceTypes';
import type { Flavor } from '../../web/stores/flavorAtom';

/** テスト用の Fake ExecutionBackend */
class FakeExecutionBackend implements ExecutionBackend {
  readonly flavor: Flavor = 'wasm';

  isReadyValue = false;
  initCalled = false;
  disposeCalled = false;
  outputCallback: ((entry: OutputEntry) => void) | null = null;
  statusCallback:
    | ((status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void)
    | null = null;

  runMock = jest.fn();
  compileMock = jest.fn();
  sendStdinMock = jest.fn();
  killMock = jest.fn();

  async init(): Promise<void> {
    this.initCalled = true;
    this.isReadyValue = true;
  }

  isReady(): boolean {
    return this.isReadyValue;
  }

  run(code: string, options: any, stdinData?: string): void {
    this.runMock(code, options, stdinData);
  }

  compile(code: string, options: any): void {
    this.compileMock(code, options);
  }

  sendStdin(data: string): void {
    this.sendStdinMock(data);
  }

  kill(): void {
    this.killMock();
  }

  dispose(): void {
    this.disposeCalled = true;
    this.isReadyValue = false;
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void,
  ): void {
    this.statusCallback = callback;
  }

  /** テストヘルパー: output コールバックをトリガー */
  triggerOutput(entry: OutputEntry): void {
    this.outputCallback?.(entry);
  }

  /** テストヘルパー: status コールバックをトリガー */
  triggerStatusChange(
    status: ExecutionStatus,
    sessionId: string,
    exitCode?: number | null,
  ): void {
    this.statusCallback?.(status, sessionId, exitCode);
  }
}

function createTestWrapper() {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, wrapper };
}

describe('useNospaceExecution', () => {
  let fakeBackend: FakeExecutionBackend;
  let backendFactory: BackendFactory;

  beforeEach(() => {
    fakeBackend = new FakeExecutionBackend();
    backendFactory = jest.fn(async () => fakeBackend);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('backend initialization', () => {
    it('backend が初期化される', async () => {
      const { wrapper } = createTestWrapper();

      renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.initCalled).toBe(true);
      });
    });

    it('backend のコールバックが設定される', async () => {
      const { wrapper } = createTestWrapper();

      renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.outputCallback).not.toBeNull();
        expect(fakeBackend.statusCallback).not.toBeNull();
      });
    });

    it('unmount 時に backend が dispose される', async () => {
      const { wrapper } = createTestWrapper();

      const { unmount } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.initCalled).toBe(true);
      });

      unmount();

      expect(fakeBackend.disposeCalled).toBe(true);
    });

    it('flavor が変更されると backend が再生成される', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(flavorAtom, 'wasm');

      const oldBackend = fakeBackend;
      const newBackend = new FakeExecutionBackend();
      const factoryMock = jest
        .fn()
        .mockResolvedValueOnce(oldBackend)
        .mockResolvedValueOnce(newBackend);

      const { rerender } = renderHook(() => useNospaceExecution(factoryMock), { wrapper });

      await waitFor(() => {
        expect(oldBackend.initCalled).toBe(true);
      });

      // flavor を変更
      act(() => {
        store.set(flavorAtom, 'server');
      });

      await waitFor(() => {
        expect(newBackend.initCalled).toBe(true);
      });

      expect(oldBackend.disposeCalled).toBe(true);
      expect(factoryMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRunning', () => {
    it('executionStatus が running のとき true を返す', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      expect(result.current.isRunning).toBe(true);
    });

    it('executionStatus が idle のとき false を返す', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('handleRun', () => {
    it('backend.run が正しい引数で呼ばれる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'print "test"');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      });
      store.set(compileOptionsAtom, {
        language: 'standard',
        target: 'ws',
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runMock).toHaveBeenCalledWith(
        'print "test"',
        {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'batch',
        },
        undefined,
      );
    });

    it('stdinData が渡される', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: true,
        ignoreDebug: true,
        inputMode: 'batch',
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun('input data');
      });

      expect(fakeBackend.runMock).toHaveBeenCalledWith(
        'code',
        expect.objectContaining({
          inputMode: 'batch',
        }),
        'input data',
      );
    });

    it('実行前に outputEntries がクリアされる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(outputEntriesAtom, [{ type: 'stdout', data: 'old', timestamp: 123 }]);

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun();
      });

      expect(store.get(outputEntriesAtom)).toEqual([]);
    });

    it('backend が ready でない場合は呼ばれない', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');

      fakeBackend.isReadyValue = false;

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runMock).not.toHaveBeenCalled();
    });

    it('実行中の場合は呼ばれない', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'running');

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runMock).not.toHaveBeenCalled();
    });
  });

  describe('handleKill', () => {
    it('backend.kill が呼ばれる', async () => {
      const { wrapper } = createTestWrapper();

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.initCalled).toBe(true);
      });

      act(() => {
        result.current.handleKill();
      });

      expect(fakeBackend.killMock).toHaveBeenCalled();
    });
  });

  describe('handleSendStdin', () => {
    it('backend.sendStdin が呼ばれる', async () => {
      const { wrapper } = createTestWrapper();

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.initCalled).toBe(true);
      });

      act(() => {
        result.current.handleSendStdin('input line\n');
      });

      expect(fakeBackend.sendStdinMock).toHaveBeenCalledWith('input line\n');
    });
  });

  describe('handleClearOutput', () => {
    it('outputEntries が空になる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(outputEntriesAtom, [
        { type: 'stdout', data: 'line1', timestamp: 100 },
        { type: 'stderr', data: 'error', timestamp: 200 },
      ]);

      const { result } = renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      act(() => {
        result.current.handleClearOutput();
      });

      expect(store.get(outputEntriesAtom)).toEqual([]);
    });
  });

  describe('backend callbacks', () => {
    it('output コールバックが outputEntries に追加される', async () => {
      const { store, wrapper } = createTestWrapper();

      renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.outputCallback).not.toBeNull();
      });

      act(() => {
        fakeBackend.triggerOutput({
          type: 'stdout',
          data: 'output data',
          timestamp: 12345,
        });
      });

      const entries = store.get(outputEntriesAtom);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        type: 'stdout',
        data: 'output data',
        timestamp: 12345,
      });
    });

    it('status コールバックが atom を更新する', async () => {
      const { store, wrapper } = createTestWrapper();

      renderHook(() => useNospaceExecution(backendFactory), { wrapper });

      await waitFor(() => {
        expect(fakeBackend.statusCallback).not.toBeNull();
      });

      act(() => {
        fakeBackend.triggerStatusChange('running', 'session-123', null);
      });

      expect(store.get(executionStatusAtom)).toBe('running');
      expect(store.get(currentSessionIdAtom)).toBe('session-123');

      act(() => {
        fakeBackend.triggerStatusChange('finished', 'session-123', 0);
      });

      expect(store.get(executionStatusAtom)).toBe('finished');
      expect(store.get(exitCodeAtom)).toBe(0);
    });
  });
});
