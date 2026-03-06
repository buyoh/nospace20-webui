import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import {
  useNospaceExecution,
  type BackendFactory,
} from '../../web/hooks/useNospaceExecution';
import { sourceCodeAtom } from '../../web/stores/editorAtom';
import {
  executionOptionsAtom,
  compileOptionsAtom,
} from '../../web/stores/optionsAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../../web/stores/executionAtom';
import { compileOutputAtom } from '../../web/stores/compileOutputAtom';
import { flavorAtom } from '../../web/stores/flavorAtom';
import type { ExecutionBackend } from '../../web/services/ExecutionBackend';
import type {
  OutputEntry,
  ExecutionStatus,
} from '../../interfaces/NospaceTypes';
import type { Flavor } from '../../web/stores/flavorAtom';

/** テスト用の Fake ExecutionBackend (jest.fn() を使わない手動実装) */
class FakeExecutionBackend implements ExecutionBackend {
  readonly flavor: Flavor = 'wasm';

  isReadyValue = false;
  initCalled = false;
  disposeCalled = false;
  outputCallback: ((entry: OutputEntry) => void) | null = null;
  statusCallback:
    | ((
        status: ExecutionStatus,
        sessionId: string,
        exitCode?: number | null
      ) => void)
    | null = null;

  /** run() 呼び出し引数の記録: [code, options, stdinData] */
  runCalls: Array<[string, any, string | undefined]> = [];
  /** compile() 呼び出し引数の記録: [code, options] */
  compileCalls: Array<[string, any]> = [];
  /** sendStdin() 呼び出し引数の記録 */
  sendStdinCalls: string[] = [];
  /** kill() 呼び出し回数 */
  killCalls: number = 0;

  async init(): Promise<void> {
    this.initCalled = true;
    this.isReadyValue = true;
  }

  isReady(): boolean {
    return this.isReadyValue;
  }

  run(code: string, options: any, stdinData?: string): void {
    this.runCalls.push([code, options, stdinData]);
  }

  compile(code: string, options: any): void {
    this.compileCalls.push([code, options]);
  }

  sendStdin(data: string): void {
    this.sendStdinCalls.push(data);
  }

  kill(): void {
    this.killCalls++;
  }

  dispose(): void {
    this.disposeCalled = true;
    this.isReadyValue = false;
  }

  onOutput(callback: (entry: OutputEntry) => void): void {
    this.outputCallback = callback;
  }

  onStatusChange(
    callback: (
      status: ExecutionStatus,
      sessionId: string,
      exitCode?: number | null
    ) => void
  ): void {
    this.statusCallback = callback;
  }

  onCompileErrors(_callback: (errors: any[]) => void): void {
    // test stub - no-op
  }

  /** テストヘルパー: output コールバックをトリガー */
  triggerOutput(entry: OutputEntry): void {
    this.outputCallback?.(entry);
  }

  /** テストヘルパー: status コールバックをトリガー */
  triggerStatusChange(
    status: ExecutionStatus,
    sessionId: string,
    exitCode?: number | null
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
    backendFactory = async (_flavor: Flavor) => fakeBackend;
  });

  afterEach(() => {
    jest.clearAllTimers();
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

      const { unmount } = renderHook(
        () => useNospaceExecution(backendFactory),
        { wrapper }
      );

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
      // factoryResults キューで順番に backend を返すプレーン関数
      const factoryResults: FakeExecutionBackend[] = [oldBackend, newBackend];
      let factoryCalls = 0;
      const factoryFn: BackendFactory = async (_flavor) => {
        return factoryResults[factoryCalls++];
      };

      const { rerender } = renderHook(() => useNospaceExecution(factoryFn), {
        wrapper,
      });

      await waitFor(() => {
        expect(oldBackend.initCalled).toBe(true);
      });

      // flavor を変更
      act(() => {
        store.set(flavorAtom, 'websocket');
      });

      await waitFor(() => {
        expect(newBackend.initCalled).toBe(true);
      });

      expect(oldBackend.disposeCalled).toBe(true);
      expect(factoryCalls).toBe(2);
    });
  });

  describe('isRunning', () => {
    it('executionStatus が running のとき true を返す', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      expect(result.current.isRunning).toBe(true);
    });

    it('executionStatus が idle のとき false を返す', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

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
        stepBudget: 10000,
        maxTotalSteps: 100_000_000,
      });
      store.set(compileOptionsAtom, {
        language: 'standard',
        target: 'ws',
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runCalls).toHaveLength(1);
      expect(fakeBackend.runCalls[0]).toEqual([
        'print "test"',
        {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'batch',
          stepBudget: 10000,
          maxTotalSteps: 100_000_000,
        },
        undefined,
      ]);
    });

    it('stdinData が渡される', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: true,
        ignoreDebug: true,
        inputMode: 'batch',
        stepBudget: 10000,
        maxTotalSteps: 100_000_000,
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun('input data');
      });

      expect(fakeBackend.runCalls).toHaveLength(1);
      expect(fakeBackend.runCalls[0][0]).toBe('code');
      expect(fakeBackend.runCalls[0][1]).toEqual(
        expect.objectContaining({
          inputMode: 'batch',
        })
      );
      expect(fakeBackend.runCalls[0][2]).toBe('input data');
    });

    it('handleRun に stepBudget / maxTotalSteps が RunOptions に含まれる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        stepBudget: 500,
        maxTotalSteps: 5000,
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runCalls).toHaveLength(1);
      expect(fakeBackend.runCalls[0][1]).toEqual(
        expect.objectContaining({
          stepBudget: 500,
          maxTotalSteps: 5000,
        })
      );
    });

    it('実行前に outputEntries がクリアされる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(outputEntriesAtom, [
        { type: 'stdout', data: 'old', timestamp: 123 },
      ]);

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

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

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runCalls).toHaveLength(0);
    });

    it('実行中の場合は呼ばれない', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'running');

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRun();
      });

      expect(fakeBackend.runCalls).toHaveLength(0);
    });
  });

  describe('handleKill', () => {
    it('backend.kill が呼ばれる', async () => {
      const { wrapper } = createTestWrapper();

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.initCalled).toBe(true);
      });

      act(() => {
        result.current.handleKill();
      });

      expect(fakeBackend.killCalls).toBe(1);
    });
  });

  describe('handleSendStdin', () => {
    it('backend.sendStdin が呼ばれる', async () => {
      const { wrapper } = createTestWrapper();

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.initCalled).toBe(true);
      });

      act(() => {
        result.current.handleSendStdin('input line\n');
      });

      expect(fakeBackend.sendStdinCalls).toEqual(['input line\n']);
    });
  });

  describe('handleClearOutput', () => {
    it('outputEntries が空になる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(outputEntriesAtom, [
        { type: 'stdout', data: 'line1', timestamp: 100 },
        { type: 'stderr', data: 'error', timestamp: 200 },
      ]);

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

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

  describe('handleCompile - compile output routing', () => {
    it('handleCompile 時に stdout が compileOutputAtom にルーティングされる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'print "test"');
      store.set(executionStatusAtom, 'idle');
      store.set(compileOptionsAtom, { language: 'standard', target: 'ws' });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleCompile();
      });

      expect(fakeBackend.compileCalls).toHaveLength(1);

      // コンパイル中の stdout をシミュレート
      act(() => {
        fakeBackend.triggerOutput({
          type: 'stdout',
          data: 'compiled ws code\n',
          timestamp: 100,
        });
      });

      const compileOutput = store.get(compileOutputAtom);
      expect(compileOutput).toEqual({
        output: 'compiled ws code\n',
        target: 'ws',
      });

      // outputEntries には追加されない
      expect(store.get(outputEntriesAtom)).toEqual([]);
    });

    it('handleCompile 時に stderr は outputEntriesAtom にルーティングされる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'bad code');
      store.set(executionStatusAtom, 'idle');
      store.set(compileOptionsAtom, {
        language: 'standard',
        target: 'mnemonic',
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleCompile();
      });

      // コンパイルエラーをシミュレート
      act(() => {
        fakeBackend.triggerOutput({
          type: 'stderr',
          data: 'compile error\n',
          timestamp: 200,
        });
      });

      // stderr は outputEntries に追加される
      const entries = store.get(outputEntriesAtom);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('stderr');

      // compileOutput は空のまま
      expect(store.get(compileOutputAtom)).toBeNull();
    });

    it('handleCompile で compileOutput がリセットされる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(compileOptionsAtom, { language: 'standard', target: 'ws' });
      store.set(compileOutputAtom, {
        output: 'old output',
        target: 'mnemonic',
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleCompile();
      });

      // handleCompile はまず null にリセットする
      expect(store.get(compileOutputAtom)).toBeNull();
    });

    it('ステータスが compiling 以外になると stdout ルーティングが通常に戻る', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(compileOptionsAtom, { language: 'standard', target: 'ws' });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleCompile();
      });

      // ステータスを finished に変更（compileTargetRef がリセットされる）
      act(() => {
        fakeBackend.triggerStatusChange('finished', 'session-1', 0);
      });

      // この後の stdout は outputEntries に追加される
      act(() => {
        fakeBackend.triggerOutput({
          type: 'stdout',
          data: 'normal output',
          timestamp: 300,
        });
      });

      const entries = store.get(outputEntriesAtom);
      expect(entries).toHaveLength(1);
      expect(entries[0].data).toBe('normal output');
    });
  });

  describe('handleRunCompileOutput', () => {
    it('コンパイル済みコードが ws 言語で実行される', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: true,
        ignoreDebug: false,
        inputMode: 'batch',
        stepBudget: 10000,
        maxTotalSteps: 100_000_000,
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRunCompileOutput('compiled ws code', 'stdin data');
      });

      expect(fakeBackend.runCalls).toHaveLength(1);
      expect(fakeBackend.runCalls[0][0]).toBe('compiled ws code');
      expect(fakeBackend.runCalls[0][1]).toEqual(
        expect.objectContaining({
          language: 'ws',
          debug: true,
          ignoreDebug: false,
          inputMode: 'batch',
        })
      );
      expect(fakeBackend.runCalls[0][2]).toBe('stdin data');
    });

    it('実行前に outputEntries がクリアされる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');
      store.set(outputEntriesAtom, [
        { type: 'stdout', data: 'old', timestamp: 1 },
      ]);

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRunCompileOutput('code');
      });

      expect(store.get(outputEntriesAtom)).toEqual([]);
    });

    it('handleRunCompileOutput に stepBudget / maxTotalSteps が RunOptions に含まれる', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
        stepBudget: 200,
        maxTotalSteps: 3000,
      });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      await waitFor(() => {
        expect(fakeBackend.isReadyValue).toBe(true);
      });

      act(() => {
        result.current.handleRunCompileOutput('compiled code');
      });

      expect(fakeBackend.runCalls).toHaveLength(1);
      expect(fakeBackend.runCalls[0][1]).toEqual(
        expect.objectContaining({
          stepBudget: 200,
          maxTotalSteps: 3000,
        })
      );
    });
  });

  describe('compileOutput', () => {
    it('compileOutput が hook から返される', async () => {
      const { store, wrapper } = createTestWrapper();
      store.set(compileOutputAtom, { output: 'test', target: 'ws' });

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      expect(result.current.compileOutput).toEqual({
        output: 'test',
        target: 'ws',
      });
    });

    it('compileOutput が null のとき null が返される', async () => {
      const { wrapper } = createTestWrapper();

      const { result } = renderHook(() => useNospaceExecution(backendFactory), {
        wrapper,
      });

      expect(result.current.compileOutput).toBeNull();
    });
  });
});
