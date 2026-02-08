// カウンターサービス - サーバー側でカウンター値を管理

export interface CounterService {
  getValue(): number;
  increment(): number;
  decrement(): number;
  reset(): number;
}

class CounterServiceImpl implements CounterService {
  private value: number = 0;

  getValue(): number {
    return this.value;
  }

  increment(): number {
    this.value++;
    return this.value;
  }

  decrement(): number {
    this.value--;
    return this.value;
  }

  reset(): number {
    this.value = 0;
    return this.value;
  }
}

export function createCounterService(): CounterService {
  return new CounterServiceImpl();
}
