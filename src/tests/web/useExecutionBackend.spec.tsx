import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import {
  useExecutionBackend,
  type BackendFactory,
} from '../../web/hooks/useExecutionBackend';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../../web/stores/executionAtom';
import {
  compileOutputAtom,
  compileStatusAtom,
} from '../../web/stores/compileOutputAtom';
import { compileErrorsAtom } from '../../web/stores/compileErrorsAtom';
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
  compileErrorsCallback: ((errors: any[]) => void) | null = null;

  runCalls: Array<[string, any, string | undefined]> = [];
  compileCalls: Array<[string, any]> = [];
  sendStdinCalls: string[] = [];
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

  onCompileErrors(callback: (errors: any[]) => void): void {
    this.compileErrorsCallback = callback;
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

  /** テストヘルパー: compileErrors コールバックをトリガー */
  triggerCompileErrors(errors: any[]): void {
    this.compileErrorsCallback?.(errors);
  }
}

function createTestWrapper() {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, wrapper };
}

describe('useExecutionBackend', () => {
  let fakeBackend: FakeExecutionBackend;
  let backendFactory: BackendFactory;

  beforeEach(() => {
    fakeBackend = new FakeExecutionBackend();
    backendFactory = async (_flavor: Flavor) => fakeBackend;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  // ─── 初期化 ───────────────────────────────────────────────────────

  it('マウント後にバックエンドを生成・初期化する', async () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useExecutionBackend('wasm', backendFactory), { wrapper });

    await waitFor(() => {
      expect(fakeBackend.initCalled).toBe(true);
    });
  });

  it('バックエンド準備完了後 backendRef が設定される', async () => {
    const { store, wrapper } = createTestWrapper();

    const { result } = renderHook(
      () => useExecutionBackend('wasm', backendFactory),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.backendRef.current).toBe(fakeBackend);
    });
  });

  // ─── onOutput ────────────────────────────────────────────────────

  it('stdout イベントが outputEntriesAtom に追加される', async () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useExecutionBackend('wasm', backendFactory), { wrapper });
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      fakeBackend.triggerOutput({ type: 'stdout', data: 'hello' });
    });

    expect(store.get(outputEntriesAtom)).toEqual([
      { type: 'stdout', data: 'hello' },
    ]);
  });

  it('stderr イベントが outputEntriesAtom に追加される', async () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useExecutionBackend('wasm', backendFactory), { wrapper });
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      fakeBackend.triggerOutput({ type: 'stderr', data: 'error msg' });
    });

    expect(store.get(outputEntriesAtom)).toEqual([
      { type: 'stderr', data: 'error msg' },
    ]);
  });

  it('compileTargetRef が設定された状態では stdout が compileOutputAtom にルーティングされる', async () => {
    const { store, wrapper } = createTestWrapper();

    const { result } = renderHook(
      () => useExecutionBackend('wasm', backendFactory),
      { wrapper }
    );
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    // compileTargetRef を手動で設定（handleCompile 相当）
    act(() => {
      result.current.compileTargetRef.current = 'ws';
    });

    act(() => {
      fakeBackend.triggerOutput({ type: 'stdout', data: 'compiled\n' });
    });

    expect(store.get(outputEntriesAtom)).toEqual([]);
    expect(store.get(compileOutputAtom)).toMatchObject({
      output: 'compiled\n',
      target: 'ws',
    });
  });

  // ─── onStatusChange ──────────────────────────────────────────────

  it('status イベントが executionStatusAtom に反映される', async () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useExecutionBackend('wasm', backendFactory), { wrapper });
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      fakeBackend.triggerStatusChange('running', 'sess-1');
    });

    expect(store.get(executionStatusAtom)).toBe('running');
    expect(store.get(currentSessionIdAtom)).toBe('sess-1');
  });

  it('exitCode が exitCodeAtom に反映される', async () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useExecutionBackend('wasm', backendFactory), { wrapper });
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      fakeBackend.triggerStatusChange('idle', 'sess-2', 42);
    });

    expect(store.get(exitCodeAtom)).toBe(42);
  });

  it('compiling → idle 遷移でエラーなしなら compileStatus が success になる', async () => {
    const { store, wrapper } = createTestWrapper();

    const { result } = renderHook(
      () => useExecutionBackend('wasm', backendFactory),
      { wrapper }
    );
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      // handleCompile 相当の操作
      result.current.prevStatusRef.current = 'compiling';
      result.current.compileHadErrorRef.current = false;
    });

    act(() => {
      fakeBackend.triggerStatusChange('idle', 'sess-3');
    });

    expect(store.get(compileStatusAtom)).toBe('success');
  });

  it('compiling → idle 遷移でエラーありなら compileStatus が error になる', async () => {
    const { store, wrapper } = createTestWrapper();

    const { result } = renderHook(
      () => useExecutionBackend('wasm', backendFactory),
      { wrapper }
    );
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      result.current.prevStatusRef.current = 'compiling';
      result.current.compileHadErrorRef.current = true;
    });

    act(() => {
      fakeBackend.triggerStatusChange('idle', 'sess-4');
    });

    expect(store.get(compileStatusAtom)).toBe('error');
  });

  // ─── onCompileErrors ─────────────────────────────────────────────

  it('compileErrors イベントが compileErrorsAtom に反映される', async () => {
    const { store, wrapper } = createTestWrapper();

    const { result } = renderHook(
      () => useExecutionBackend('wasm', backendFactory),
      { wrapper }
    );
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    const errors = [{ line: 1, message: 'syntax error' }];
    act(() => {
      fakeBackend.triggerCompileErrors(errors);
    });

    expect(store.get(compileErrorsAtom)).toEqual(errors);
    expect(result.current.compileHadErrorRef.current).toBe(true);
  });

  // ─── アンマウント ────────────────────────────────────────────────

  it('アンマウント時にバックエンドを dispose する', async () => {
    const { store, wrapper } = createTestWrapper();

    const { unmount } = renderHook(
      () => useExecutionBackend('wasm', backendFactory),
      { wrapper }
    );
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      unmount();
    });

    expect(fakeBackend.disposeCalled).toBe(true);
  });

  // ─── Flavor 変更 ──────────────────────────────────────────────────

  it('Flavor が変更されると古いバックエンドを dispose して新しいバックエンドを生成する', async () => {
    const { store, wrapper } = createTestWrapper();

    const secondBackend = new FakeExecutionBackend();
    let callCount = 0;
    const multiFactory: BackendFactory = async (_flavor: Flavor) => {
      callCount++;
      return callCount === 1 ? fakeBackend : secondBackend;
    };

    const { rerender, result } = renderHook(
      ({ flavor }: { flavor: Flavor }) =>
        useExecutionBackend(flavor, multiFactory),
      { wrapper, initialProps: { flavor: 'wasm' as Flavor } }
    );
    await waitFor(() => expect(fakeBackend.initCalled).toBe(true));

    act(() => {
      rerender({ flavor: 'websocket' });
    });

    await waitFor(() => expect(secondBackend.initCalled).toBe(true));

    expect(fakeBackend.disposeCalled).toBe(true);
    expect(result.current.backendRef.current).toBe(secondBackend);
  });
});
