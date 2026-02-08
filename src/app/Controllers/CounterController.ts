// カウンターコントローラー - Socket.IO イベントのビジネスロジック

import { CounterService } from '../Services/CounterService';
import { CounterState } from '../../interfaces/CounterTypes';

export interface CounterController {
  handleIncrement(): void;
  handleDecrement(): void;
  handleReset(): void;
  getCurrentState(): CounterState;
}

export interface BroadcastFunction {
  (state: CounterState): void;
}

class CounterControllerImpl implements CounterController {
  constructor(
    private readonly counterService: CounterService,
    private readonly broadcast: BroadcastFunction
  ) {}

  handleIncrement(): void {
    this.counterService.increment();
    this.broadcast({ value: this.counterService.getValue() });
  }

  handleDecrement(): void {
    this.counterService.decrement();
    this.broadcast({ value: this.counterService.getValue() });
  }

  handleReset(): void {
    this.counterService.reset();
    this.broadcast({ value: this.counterService.getValue() });
  }

  getCurrentState(): CounterState {
    return { value: this.counterService.getValue() };
  }
}

export function createCounterController(
  counterService: CounterService,
  broadcast: BroadcastFunction
): CounterController {
  return new CounterControllerImpl(counterService, broadcast);
}
