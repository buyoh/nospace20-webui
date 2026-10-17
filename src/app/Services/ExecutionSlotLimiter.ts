/** 同時実行プロセス数を制限するカウンタ */
export class ExecutionSlotLimiter {
  private used = 0;

  constructor(private readonly max: number) {}

  /**
   * 空きがあれば確保して解放関数を返す。空きがなければ null を返す。
   * 返す解放関数は冪等で、2 回目以降の呼び出しは何もしない。
   */
  tryAcquire(): (() => void) | null {
    if (this.used >= this.max) return null;
    this.used += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.used -= 1;
    };
  }
}

/** 同時実行数の上限に達していて新しいプロセスを開始できないことを表すエラー */
export class ExecutionLimitError extends Error {
  constructor(message = 'Too many running processes') {
    super(message);
    this.name = 'ExecutionLimitError';
  }
}
