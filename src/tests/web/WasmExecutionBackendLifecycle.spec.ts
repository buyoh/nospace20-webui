// WasmExecutionBackend の VM 所有権・実行の置き換え・dispose・入力の範囲制限のテスト

import type { ExecutionStatus } from '../../interfaces/NospaceTypes';
import {
  WasmExecutionBackend,
  type Nospace20Loader,
} from '../../web/services/WasmExecutionBackend';

/** step() の呼び出しと free() を記録するフェイク VM */
class FakeVm {
  static instances: FakeVm[] = [];
  /** true の間、step() は 'running' を返し続ける */
  static keepRunning = true;
  stepBudgets: number[] = [];
  freeCount = 0;
  /** free 済みの VM で step() が呼ばれたか（use-after-free の検出） */
  usedAfterFree = false;

  constructor() {
    FakeVm.instances.push(this);
  }
  static fromWhitespace() {
    return new FakeVm();
  }
  step(budget: number) {
    if (this.freeCount > 0) this.usedAfterFree = true;
    this.stepBudgets.push(budget);
    return { status: FakeVm.keepRunning ? 'running' : 'complete' };
  }
  total_steps() {
    return 0;
  }
  flush_stdout() {
    return '';
  }
  get_traced() {
    return {};
  }
  free() {
    this.freeCount += 1;
  }
}

const fakeLoader: Nospace20Loader = {
  initNospace20Wasm: async () => {},
  getNospace20: () => ({ WasmWhitespaceVM: FakeVm }),
};

/** step ループがタイマーで進むのを待つ */
const wait = (ms = 30) => new Promise<void>((r) => setTimeout(r, ms));

const runOptions = {
  language: 'standard' as const,
  debug: false,
  inputMode: 'batch' as const,
};

describe('WasmExecutionBackend lifecycle', () => {
  let backend: WasmExecutionBackend;
  let statuses: Array<[ExecutionStatus, string]>;

  beforeEach(async () => {
    FakeVm.instances = [];
    FakeVm.keepRunning = true;
    statuses = [];
    backend = new WasmExecutionBackend(fakeLoader);
    await backend.init();
    backend.onOutput(() => {});
    backend.onStatusChange((status, sessionId) =>
      statuses.push([status, sessionId])
    );
  });

  afterEach(() => {
    FakeVm.keepRunning = false;
    backend.dispose();
  });

  describe('stepBudget / maxTotalSteps の範囲制限', () => {
    it('BUG: 0・巨大値・NaN の stepBudget は許容範囲に収めて VM に渡される', async () => {
      FakeVm.keepRunning = false;
      for (const stepBudget of [0, 1e12, NaN, undefined]) {
        backend.run('code', { ...runOptions, stepBudget });
        await wait(10);
      }

      expect(FakeVm.instances.map((vm) => vm.stepBudgets[0])).toEqual([
        100, 1_000_000, 10_000, 10_000,
      ]);
    });
  });

  describe('実行の置き換え', () => {
    it('BUG: 実行中に run() し直しても、旧ループが新しい VM を解放しない（use-after-free）', async () => {
      backend.run('a', runOptions);
      await wait();
      backend.run('b', runOptions);
      await wait(60);

      const [vmA, vmB] = FakeVm.instances;
      expect(vmA.freeCount).toBe(1);
      expect(vmB.freeCount).toBe(0);
      expect(vmB.usedAfterFree).toBe(false);
      // 新しい実行は動き続けている
      const stepsBefore = vmB.stepBudgets.length;
      await wait();
      expect(vmB.stepBudgets.length).toBeGreaterThan(stepsBefore);
    });

    it('BUG: 置き換えられた旧実行の killed が、新しい実行の状態を上書きしない', async () => {
      backend.run('a', runOptions);
      await wait();
      backend.run('b', runOptions);
      await wait(60);

      expect(statuses.map(([s]) => s)).toEqual(['running', 'running']);
      expect(statuses[0][1]).not.toBe(statuses[1][1]);

      backend.kill();
      await wait();
      expect(statuses.map(([s]) => s)).toEqual([
        'running',
        'running',
        'killed',
      ]);
      expect(statuses[2][1]).toBe(statuses[1][1]);
    });
  });

  describe('kill と run', () => {
    it('kill() だけなら、中断された実行の killed を通知する', async () => {
      backend.run('a', runOptions);
      await wait();

      backend.kill();
      await wait(60);

      expect(statuses.map(([s]) => s)).toEqual(['running', 'killed']);
    });

    it('BUG: kill() の直後に run() しても、旧実行の killed が新しい実行の状態を上書きしない', async () => {
      backend.run('a', runOptions);
      await wait();

      backend.kill();
      backend.run('b', runOptions);
      await wait(60);

      expect(statuses.map(([s]) => s)).toEqual(['running', 'running']);
      expect(FakeVm.instances[1].freeCount).toBe(0);
    });
  });

  describe('dispose', () => {
    it('実行中の VM を一度だけ解放する（ループ終了時に二重解放しない）', async () => {
      backend.run('a', runOptions);
      await wait();

      backend.dispose();
      await wait(60);

      expect(FakeVm.instances[0].freeCount).toBe(1);
    });

    it('BUG: dispose 後は中断された実行の killed 通知が UI に流れ込まない', async () => {
      backend.run('a', runOptions);
      await wait();
      const countBeforeDispose = statuses.length;

      backend.dispose();
      await wait(60);

      expect(statuses).toHaveLength(countBeforeDispose);
    });
  });
});
