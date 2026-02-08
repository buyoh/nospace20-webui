import { CounterService } from '../../app/Services/CounterService';

describe('CounterService', () => {
  let counterService: CounterService;

  beforeEach(() => {
    // 各テストで新しいインスタンスが必要なため、モジュールをリセット
    jest.resetModules();
    const {
      createCounterService: create,
    } = require('../../app/Services/CounterService');
    counterService = create();
  });

  describe('getValue', () => {
    it('初期値は0である', () => {
      expect(counterService.getValue()).toBe(0);
    });
  });

  describe('increment', () => {
    it('値を1増加させる', () => {
      const result = counterService.increment();
      expect(result).toBe(1);
      expect(counterService.getValue()).toBe(1);
    });

    it('連続して増加させることができる', () => {
      counterService.increment();
      counterService.increment();
      counterService.increment();
      expect(counterService.getValue()).toBe(3);
    });
  });

  describe('decrement', () => {
    it('値を1減少させる', () => {
      const result = counterService.decrement();
      expect(result).toBe(-1);
      expect(counterService.getValue()).toBe(-1);
    });
  });

  describe('reset', () => {
    it('値を0にリセットする', () => {
      counterService.increment();
      counterService.increment();
      const result = counterService.reset();
      expect(result).toBe(0);
      expect(counterService.getValue()).toBe(0);
    });
  });
});
