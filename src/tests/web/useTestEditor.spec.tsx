import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useTestEditor } from '../../web/hooks/useTestEditor';
import { useTestTree } from '../../web/hooks/useTestTree';
import {
  editingTestCaseAtom,
  testEditorDirtyAtom,
  testEditorErrorAtom,
  testEditorCreateModeAtom,
  selectedTestPathAtom,
} from '../../web/stores/testEditorAtom';
import { TestApiClient } from '../../web/services/TestApiClient';
import type {
  TestCaseCreateRequest,
  TestCaseResponse,
  TestCaseUpdateRequest,
} from '../../interfaces/TestTypes';

/** テスト管理 API のフェイク（ネットワークに接続しない） */
class FakeTestApiClient extends TestApiClient {
  fetchError: Error | null = null;
  updateError: Error | null = null;
  createError: Error | null = null;
  /** 設定すると fetchTestCase はこの Promise の解決まで待つ */
  fetchGate: Promise<void> | null = null;
  response: TestCaseResponse = { path: 'a/b', source: 'src', check: '{}' };
  updateCalls: Array<[string, TestCaseUpdateRequest]> = [];
  createCalls: TestCaseCreateRequest[] = [];

  async fetchTestCase(path: string): Promise<TestCaseResponse> {
    if (this.fetchGate) await this.fetchGate;
    if (this.fetchError) throw this.fetchError;
    return { ...this.response, path };
  }

  async updateTestCase(
    path: string,
    data: TestCaseUpdateRequest
  ): Promise<void> {
    this.updateCalls.push([path, data]);
    if (this.updateError) throw this.updateError;
  }

  async createTestCase(data: TestCaseCreateRequest): Promise<void> {
    this.createCalls.push(data);
    if (this.createError) throw this.createError;
  }
}

function setup(confirmResult = true) {
  const store = createStore();
  const client = new FakeTestApiClient();
  const confirmCalls: string[] = [];
  const confirm = (message: string) => {
    confirmCalls.push(message);
    return confirmResult;
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, client, confirm, confirmCalls, wrapper };
}

describe('useTestEditor', () => {
  it('BUG: 読み込みが失敗しても例外を投げず、エラーを atom に設定し、testCase は null になる', async () => {
    const { store, client, confirm, wrapper } = setup();
    client.fetchError = new Error('404 Not Found');
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    await act(async () => {
      await result.current.loadTestCase('a/b');
    });

    expect(store.get(testEditorErrorAtom)).toContain('404 Not Found');
    expect(store.get(editingTestCaseAtom)).toBeNull();
  });

  it('BUG: 中断された読み込みの結果は反映されない（古いレスポンスで上書きしない）', async () => {
    const { store, client, confirm, wrapper } = setup();
    let release!: () => void;
    client.fetchGate = new Promise<void>((r) => (release = r));
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });
    const controller = new AbortController();

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadTestCase('a/old', controller.signal);
    });
    controller.abort();
    await act(async () => {
      release();
      await pending;
    });

    expect(store.get(editingTestCaseAtom)).toBeNull();
    expect(store.get(testEditorErrorAtom)).toBeNull();
  });

  it('読み込み開始時に testCase が null になり、読み込み中の updateSource では dirty にならない', async () => {
    const { store, client, confirm, wrapper } = setup();
    store.set(editingTestCaseAtom, { path: 'old', source: 's', check: null });
    let release!: () => void;
    client.fetchGate = new Promise<void>((r) => (release = r));
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.loadTestCase('a/new');
    });
    expect(store.get(editingTestCaseAtom)).toBeNull();

    act(() => result.current.updateSource('edited while loading'));
    expect(store.get(testEditorDirtyAtom)).toBe(false);

    await act(async () => {
      release();
      await pending;
    });
    expect(store.get(editingTestCaseAtom)?.path).toBe('a/new');
  });

  it('保存に失敗すると false を返し、dirty のままエラーを設定する', async () => {
    const { store, client, confirm, wrapper } = setup();
    client.updateError = new Error('500');
    store.set(editingTestCaseAtom, { path: 'a/b', source: 's', check: '{}' });
    store.set(testEditorDirtyAtom, true);
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(store.get(testEditorDirtyAtom)).toBe(true);
    expect(store.get(testEditorErrorAtom)).toContain('500');
  });

  it('BUG: check が空文字なら空文字のまま API に渡し（ファイル削除）、null なら変更なしとする', async () => {
    const { store, client, confirm, wrapper } = setup();
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    // store の変更は act 内で行い、フックが最新の isDirty / testCase で再描画されるようにする
    act(() => {
      store.set(editingTestCaseAtom, { path: 'a/b', source: 's', check: '' });
      store.set(testEditorDirtyAtom, true);
    });
    await act(async () => {
      await result.current.save();
    });
    act(() => {
      store.set(editingTestCaseAtom, {
        path: 'a/b',
        source: 's',
        check: null,
      });
      store.set(testEditorDirtyAtom, true);
    });
    await act(async () => {
      await result.current.save();
    });

    expect(client.updateCalls[0][1].check).toBe('');
    expect(client.updateCalls[1][1].check).toBeUndefined();
  });

  it('BUG: 作成に成功すると dirty が解除され、作成したテストが選択され、作成モードを抜ける', async () => {
    const { store, client, confirm, wrapper } = setup();
    store.set(testEditorCreateModeAtom, true);
    store.set(editingTestCaseAtom, {
      path: '(new test case)',
      source: 'x',
      check: '',
    });
    store.set(testEditorDirtyAtom, true);
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    let path: string | null = null;
    await act(async () => {
      path = await result.current.create({
        category: 'passes',
        fileName: 't1',
        source: 'x',
        check: '',
      });
    });

    expect(path).toBe('passes/t1');
    expect(store.get(testEditorDirtyAtom)).toBe(false);
    expect(store.get(testEditorCreateModeAtom)).toBe(false);
    expect(store.get(selectedTestPathAtom)).toBe('passes/t1');
    // 仮データが残ると編集フォームが "(new test case)" を保存できてしまう
    expect(store.get(editingTestCaseAtom)).toBeNull();
    expect(client.createCalls[0].check).toBeUndefined();
  });

  it('作成に失敗すると null を返し、作成モードのまま保持してエラーを設定する', async () => {
    const { store, client, confirm, wrapper } = setup();
    client.createError = new Error('409 Conflict');
    store.set(testEditorCreateModeAtom, true);
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    let path: string | null = 'unset';
    await act(async () => {
      path = await result.current.create({
        category: 'c',
        fileName: 'f',
        source: 's',
        check: '',
      });
    });

    expect(path).toBeNull();
    expect(store.get(testEditorCreateModeAtom)).toBe(true);
    expect(store.get(testEditorErrorAtom)).toContain('409');
  });

  it('dirty のとき、確認を拒否すると startCreate / cancelCreate は状態を変えない', () => {
    const { store, client, confirm, confirmCalls, wrapper } = setup(false);
    store.set(editingTestCaseAtom, { path: 'a/b', source: 's', check: null });
    store.set(testEditorDirtyAtom, true);
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    act(() => result.current.startCreate());
    expect(store.get(testEditorCreateModeAtom)).toBe(false);

    store.set(testEditorCreateModeAtom, true);
    act(() => result.current.cancelCreate());
    expect(store.get(testEditorCreateModeAtom)).toBe(true);
    expect(store.get(editingTestCaseAtom)?.path).toBe('a/b');
    expect(confirmCalls).toHaveLength(2);
  });

  it('dirty でなければ確認せずに startCreate できる', () => {
    const { store, client, confirm, confirmCalls, wrapper } = setup(false);
    const { result } = renderHook(() => useTestEditor(client, confirm), {
      wrapper,
    });

    act(() => result.current.startCreate());

    expect(store.get(testEditorCreateModeAtom)).toBe(true);
    expect(confirmCalls).toHaveLength(0);
  });
});

describe('useTestTree.selectTest', () => {
  it('dirty のとき確認を拒否すると選択が変わらず、承認すると変わる', () => {
    const rejected = setup(false);
    rejected.store.set(selectedTestPathAtom, 'a/old');
    rejected.store.set(testEditorDirtyAtom, true);
    const r1 = renderHook(
      () => useTestTree(rejected.client, rejected.confirm),
      { wrapper: rejected.wrapper }
    );
    act(() => r1.result.current.selectTest('a/new'));
    expect(rejected.store.get(selectedTestPathAtom)).toBe('a/old');

    const accepted = setup(true);
    accepted.store.set(selectedTestPathAtom, 'a/old');
    accepted.store.set(testEditorDirtyAtom, true);
    const r2 = renderHook(
      () => useTestTree(accepted.client, accepted.confirm),
      { wrapper: accepted.wrapper }
    );
    act(() => r2.result.current.selectTest('a/new'));
    expect(accepted.store.get(selectedTestPathAtom)).toBe('a/new');
  });

  it('dirty でなければ確認せずに選択できる', () => {
    const { store, client, confirm, confirmCalls, wrapper } = setup(false);
    const { result } = renderHook(() => useTestTree(client, confirm), {
      wrapper,
    });

    act(() => result.current.selectTest('a/new'));

    expect(store.get(selectedTestPathAtom)).toBe('a/new');
    expect(confirmCalls).toHaveLength(0);
  });

  it('作成モード中の選択は作成モードを終了して選択する（同じパスでも）', () => {
    const { store, client, confirm, wrapper } = setup();
    store.set(selectedTestPathAtom, 'a/same');
    store.set(testEditorCreateModeAtom, true);
    const { result } = renderHook(() => useTestTree(client, confirm), {
      wrapper,
    });

    act(() => result.current.selectTest('a/same'));

    expect(store.get(testEditorCreateModeAtom)).toBe(false);
    expect(store.get(selectedTestPathAtom)).toBe('a/same');
  });
});
