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
  backendStateAtom,
} from '../../web/stores/executionAtom';
import {
  compileOutputAtom,
  compileStatusAtom,
} from '../../web/stores/compileOutputAtom';
import { compileErrorsAtom } from '../../web/stores/compileErrorsAtom';
import type {
  ConnectionState,
  ExecutionBackend,
} from '../../web/services/ExecutionBackend';
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

  /** 設定すると init() はこの Promise の解決まで待つ（遅い初期化の再現用） */
  initGate: Promise<void> | null = null;
  /** 設定すると init() はこのエラーで reject する */
  initError: Error | null = null;
  connectionCallback: ((state: ConnectionState) => void) | null = null;

  async init(): Promise<void> {
    this.initCalled = true;
    if (this.initGate) await this.initGate;
    if (this.initError) throw this.initError;
    this.isReadyValue = true;
  }

  onConnectionChange(callback: (state: ConnectionState) => void): void {
    this.connectionCallback = callback;
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
    const { wrapper } = createTestWrapper();

    renderHook(() => useExecutionBackend('wasm', backendFactory), { wrapper });

    await waitFor(() => {
      expect(fakeBackend.initCalled).toBe(true);
    });
  });

  it('バックエンド準備完了後 backendRef が設定される', async () => {
    const { wrapper } = createTestWrapper();

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
    const { wrapper } = createTestWrapper();

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
    const { wrapper } = createTestWrapper();

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

  // ─── 初期化の競合・失敗・状態 ───────────────────────────────────────

  describe('backendState と初期化の競合', () => {
    /** 手動で解決できる Promise */
    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, resolve };
    }

    it('初期化中は initializing、完了後は ready になる', async () => {
      const { store, wrapper } = createTestWrapper();
      const gate = deferred();
      fakeBackend.initGate = gate.promise;

      renderHook(() => useExecutionBackend('wasm', backendFactory), {
        wrapper,
      });
      await waitFor(() => expect(fakeBackend.initCalled).toBe(true));
      expect(store.get(backendStateAtom)).toEqual({ kind: 'initializing' });

      await act(async () => gate.resolve());

      await waitFor(() =>
        expect(store.get(backendStateAtom)).toEqual({ kind: 'ready' })
      );
    });

    it('BUG: 遅い init が flavor 切り替え後に完了しても、古い backend は採用されず dispose される', async () => {
      const { wrapper } = createTestWrapper();
      const gate = deferred();
      const slowBackend = new FakeExecutionBackend();
      slowBackend.initGate = gate.promise;
      const fastBackend = new FakeExecutionBackend();
      const factory: BackendFactory = async (flavor) =>
        flavor === 'websocket' ? slowBackend : fastBackend;

      const { rerender, result } = renderHook(
        ({ flavor }: { flavor: Flavor }) =>
          useExecutionBackend(flavor, factory),
        { wrapper, initialProps: { flavor: 'websocket' as Flavor } }
      );
      await waitFor(() => expect(slowBackend.initCalled).toBe(true));

      // websocket の接続完了前に wasm へ戻す
      rerender({ flavor: 'wasm' });
      await waitFor(() =>
        expect(result.current.backendRef.current).toBe(fastBackend)
      );

      // 遅い init が後から完了する
      await act(async () => gate.resolve());

      expect(result.current.backendRef.current).toBe(fastBackend);
      expect(slowBackend.disposeCalled).toBe(true);
      expect(fastBackend.disposeCalled).toBe(false);
    });

    it('BUG: init 中にアンマウントされた場合、init 完了後も backendRef に残らず dispose される', async () => {
      const { wrapper } = createTestWrapper();
      const gate = deferred();
      fakeBackend.initGate = gate.promise;

      const { unmount, result } = renderHook(
        () => useExecutionBackend('wasm', backendFactory),
        { wrapper }
      );
      await waitFor(() => expect(fakeBackend.initCalled).toBe(true));
      unmount();
      await act(async () => gate.resolve());

      expect(result.current.backendRef.current).toBeNull();
      expect(fakeBackend.disposeCalled).toBe(true);
    });

    it('factory が reject しても未処理にならず、backendState が error になる', async () => {
      const { store, wrapper } = createTestWrapper();
      const factory: BackendFactory = async () => {
        throw new Error('chunk load failed');
      };

      renderHook(() => useExecutionBackend('wasm', factory), { wrapper });

      await waitFor(() =>
        expect(store.get(backendStateAtom)).toEqual({
          kind: 'error',
          message: 'chunk load failed',
        })
      );
    });

    it('init が reject したら backend を採用せず error になり、retry で再初期化して ready になる', async () => {
      const { store, wrapper } = createTestWrapper();
      const failing = new FakeExecutionBackend();
      failing.initError = new Error('WASM fetch failed');
      const recovered = new FakeExecutionBackend();
      let calls = 0;
      const factory: BackendFactory = async () =>
        ++calls === 1 ? failing : recovered;

      const { result } = renderHook(
        () => useExecutionBackend('wasm', factory),
        { wrapper }
      );
      await waitFor(() =>
        expect(store.get(backendStateAtom)).toEqual({
          kind: 'error',
          message: 'WASM fetch failed',
        })
      );
      expect(result.current.backendRef.current).toBeNull();
      expect(failing.disposeCalled).toBe(true);

      act(() => result.current.retry());

      await waitFor(() =>
        expect(store.get(backendStateAtom)).toEqual({ kind: 'ready' })
      );
      expect(result.current.backendRef.current).toBe(recovered);
    });

    it('init 失敗で dispose された backend が後からコールバックを呼んでも atom は変化しない', async () => {
      const { store, wrapper } = createTestWrapper();
      fakeBackend.initError = new Error('boom');

      renderHook(() => useExecutionBackend('wasm', backendFactory), {
        wrapper,
      });
      await waitFor(() =>
        expect(store.get(backendStateAtom).kind).toBe('error')
      );

      act(() => {
        fakeBackend.triggerStatusChange('running', 'late');
        fakeBackend.triggerOutput({
          type: 'stdout',
          data: 'late',
          timestamp: 0,
        });
      });

      expect(store.get(executionStatusAtom)).toBe('idle');
      expect(store.get(outputEntriesAtom)).toEqual([]);
    });

    it('flavor 切り替えで実行状態・コンパイル状態・追跡 ref がリセットされる', async () => {
      const { store, wrapper } = createTestWrapper();
      const second = new FakeExecutionBackend();
      let calls = 0;
      const factory: BackendFactory = async () =>
        ++calls === 1 ? fakeBackend : second;
      const { result, rerender } = renderHook(
        ({ flavor }: { flavor: Flavor }) =>
          useExecutionBackend(flavor, factory),
        { wrapper, initialProps: { flavor: 'websocket' as Flavor } }
      );
      await waitFor(() =>
        expect(result.current.backendRef.current).toBe(fakeBackend)
      );
      // websocket でコンパイル中
      result.current.compileTargetRef.current = 'ws';
      result.current.prevStatusRef.current = 'compiling';
      act(() => fakeBackend.triggerStatusChange('compiling', 's'));
      expect(store.get(executionStatusAtom)).toBe('compiling');

      rerender({ flavor: 'wasm' });

      await waitFor(() =>
        expect(result.current.backendRef.current).toBe(second)
      );
      expect(store.get(executionStatusAtom)).toBe('idle');
      expect(store.get(compileStatusAtom)).toBeNull();
      expect(result.current.compileTargetRef.current).toBeNull();
      expect(result.current.prevStatusRef.current).toBeNull();
    });

    it('接続状態の変化が backendState に反映される', async () => {
      const { store, wrapper } = createTestWrapper();
      renderHook(() => useExecutionBackend('websocket', backendFactory), {
        wrapper,
      });
      await waitFor(() =>
        expect(store.get(backendStateAtom)).toEqual({ kind: 'ready' })
      );

      act(() => fakeBackend.connectionCallback?.('reconnecting'));
      expect(store.get(backendStateAtom)).toEqual({ kind: 'disconnected' });

      act(() => fakeBackend.connectionCallback?.('connected'));
      expect(store.get(backendStateAtom)).toEqual({ kind: 'ready' });

      act(() => fakeBackend.connectionCallback?.('lost'));
      expect(store.get(backendStateAtom).kind).toBe('error');
    });
  });

  describe('コンパイル結果と出力上限', () => {
    it('BUG: 構造化エラーがなくても compiling → error で終わったら compileStatus は error になる', async () => {
      const { store, wrapper } = createTestWrapper();
      const { result } = renderHook(
        () => useExecutionBackend('websocket', backendFactory),
        { wrapper }
      );
      await waitFor(() =>
        expect(result.current.backendRef.current).toBe(fakeBackend)
      );
      result.current.prevStatusRef.current = 'compiling';
      result.current.compileTargetRef.current = 'ws';
      act(() => fakeBackend.triggerStatusChange('compiling', 's'));

      // 切断・サーバエラーなど（構造化エラーなし）
      act(() => fakeBackend.triggerStatusChange('error', 's', null));

      expect(store.get(compileStatusAtom)).toBe('error');
    });

    it('出力は同種エントリが連結され、上限を超えると古い出力が捨てられる', async () => {
      const { store, wrapper } = createTestWrapper();
      const { result } = renderHook(
        () => useExecutionBackend('wasm', backendFactory, { maxChars: 10 }),
        { wrapper }
      );
      await waitFor(() =>
        expect(result.current.backendRef.current).toBe(fakeBackend)
      );

      act(() => {
        for (let i = 0; i < 5; i++) {
          fakeBackend.triggerOutput({
            type: 'stdout',
            data: '0123456789',
            timestamp: i,
          });
        }
      });

      const entries = store.get(outputEntriesAtom);
      expect(entries[0].data).toContain('omitted');
      const body = entries
        .slice(1)
        .map((e) => e.data)
        .join('');
      // 上限以内に収まり、最新の出力が残る
      expect(body.length).toBeLessThanOrEqual(10);
      expect('0123456789'.endsWith(body.slice(-1))).toBe(true);
    });
  });
});
