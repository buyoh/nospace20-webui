import {
  CounterController,
  createCounterController,
  BroadcastFunction,
} from '../../app/Controllers/CounterController';
import { CounterService } from '../../app/Services/CounterService';

describe('CounterController', () => {
  let controller: CounterController;
  let mockCounterService: jest.Mocked<CounterService>;
  let mockBroadcast: jest.Mock<void, [{ value: number }]>;

  beforeEach(() => {
    // CounterService のモックを作成
    mockCounterService = {
      getValue: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      reset: jest.fn(),
    };

    // ブロードキャスト関数のモックを作成
    mockBroadcast = jest.fn();

    // コントローラーを作成
    controller = createCounterController(mockCounterService, mockBroadcast);
  });

  describe('handleIncrement', () => {
    it('counterService.increment を呼び出し、ブロードキャストする', () => {
      mockCounterService.getValue.mockReturnValue(5);

      controller.handleIncrement();

      expect(mockCounterService.increment).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledWith({ value: 5 });
    });
  });

  describe('handleDecrement', () => {
    it('counterService.decrement を呼び出し、ブロードキャストする', () => {
      mockCounterService.getValue.mockReturnValue(3);

      controller.handleDecrement();

      expect(mockCounterService.decrement).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledWith({ value: 3 });
    });
  });

  describe('handleReset', () => {
    it('counterService.reset を呼び出し、ブロードキャストする', () => {
      mockCounterService.getValue.mockReturnValue(0);

      controller.handleReset();

      expect(mockCounterService.reset).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
      expect(mockBroadcast).toHaveBeenCalledWith({ value: 0 });
    });
  });

  describe('getCurrentState', () => {
    it('現在のカウンター状態を返す', () => {
      mockCounterService.getValue.mockReturnValue(42);

      const state = controller.getCurrentState();

      expect(state).toEqual({ value: 42 });
      expect(mockCounterService.getValue).toHaveBeenCalledTimes(1);
    });
  });
});
