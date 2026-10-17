import { ExecutionSlotLimiter } from '../../app/Services/ExecutionSlotLimiter';

describe('ExecutionSlotLimiter', () => {
  it('上限まで確保でき、超過すると null を返す', () => {
    const limiter = new ExecutionSlotLimiter(2);

    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.tryAcquire()).toBeNull();
  });

  it('解放すると再び確保できる', () => {
    const limiter = new ExecutionSlotLimiter(1);
    const release = limiter.tryAcquire()!;

    release();

    expect(limiter.tryAcquire()).not.toBeNull();
  });

  it('解放関数を複数回呼んでも二重に解放されない', () => {
    const limiter = new ExecutionSlotLimiter(1);
    const release = limiter.tryAcquire()!;

    release();
    release();

    expect(limiter.tryAcquire()).not.toBeNull();
    expect(limiter.tryAcquire()).toBeNull();
  });
});
