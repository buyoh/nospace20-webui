import {
  createNospace20Loader,
  type Nospace20Module,
} from '../../../web/libs/nospace20/loader';

const fakeModule = {} as Nospace20Module;

describe('createNospace20Loader', () => {
  it('初期化前の get は例外を投げる', () => {
    const loader = createNospace20Loader(async () => fakeModule);

    expect(() => loader.get()).toThrow('WASM not initialized');
    expect(loader.isInitialized()).toBe(false);
  });

  it('初期化後は get でモジュールを返し、import は一度だけ呼ばれる', async () => {
    let importCount = 0;
    const loader = createNospace20Loader(async () => {
      importCount += 1;
      return fakeModule;
    });

    await Promise.all([loader.init(), loader.init()]);
    await loader.init();

    expect(loader.get()).toBe(fakeModule);
    expect(importCount).toBe(1);
  });

  it('BUG: 初回の import が失敗しても、次回の init で再試行して成功できる', async () => {
    let importCount = 0;
    const loader = createNospace20Loader(async () => {
      importCount += 1;
      if (importCount === 1) throw new Error('chunk load failed');
      return fakeModule;
    });

    await expect(loader.init()).rejects.toThrow('chunk load failed');
    expect(loader.isInitialized()).toBe(false);

    await loader.init();

    expect(importCount).toBe(2);
    expect(loader.get()).toBe(fakeModule);
  });
});
