import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useNospaceExecution } from '../../web/hooks/useNospaceExecution';
import { useNospaceSocket } from '../../web/hooks/useNospaceSocket';
import { sourceCodeAtom } from '../../web/stores/editorAtom';
import { executionOptionsAtom } from '../../web/stores/optionsAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
} from '../../web/stores/executionAtom';
import type { AppSocket } from '../../web/stores/socketAtom';

// Mock useNospaceSocket
jest.mock('../../web/hooks/useNospaceSocket');

const mockUseNospaceSocket = useNospaceSocket as jest.MockedFunction<
  typeof useNospaceSocket
>;

function createTestWrapper() {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, wrapper };
}

describe('useNospaceExecution', () => {
  let mockSocket: jest.Mocked<AppSocket>;

  beforeEach(() => {
    // Create mock socket
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      id: 'mock-socket-id',
    } as unknown as jest.Mocked<AppSocket>;

    mockUseNospaceSocket.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRunning', () => {
    it('executionStatus が running のとき true を返す', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      expect(result.current.isRunning).toBe(true);
    });

    it('executionStatus が idle のとき false を返す', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      expect(result.current.isRunning).toBe(false);
    });
  });

  describe('handleRun', () => {
    it('socket 存在 & 非実行中で emit される', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'print "test"');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: false,
        ignoreDebug: false,
        inputMode: 'batch',
      });

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleRun();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_run', {
        code: 'print "test"',
        options: {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'batch',
        },
        stdinData: undefined,
      });
    });

    it('batch モードで stdinData が含まれる', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: true,
        ignoreDebug: true,
        inputMode: 'batch',
      });

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleRun('input data');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_run', {
        code: 'code',
        options: {
          language: 'standard',
          debug: true,
          ignoreDebug: true,
          inputMode: 'batch',
        },
        stdinData: 'input data',
      });
    });

    it('interactive モードで stdinData が undefined', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(executionOptionsAtom, {
        debug: false,
        ignoreDebug: false,
        inputMode: 'interactive',
      });

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleRun('should be ignored');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_run', {
        code: 'code',
        options: {
          language: 'standard',
          debug: false,
          ignoreDebug: false,
          inputMode: 'interactive',
        },
        stdinData: undefined,
      });
    });

    it('実行前に outputEntries がクリアされる', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');
      store.set(outputEntriesAtom, [
        { type: 'stdout', data: 'old', timestamp: 123 },
      ]);

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleRun();
      });

      expect(store.get(outputEntriesAtom)).toEqual([]);
    });

    it('socket が null のとき emit されない', () => {
      mockUseNospaceSocket.mockReturnValue(null);

      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'idle');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleRun();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('実行中のとき emit されない', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(sourceCodeAtom, 'code');
      store.set(executionStatusAtom, 'running');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleRun();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleKill', () => {
    it('正常系で emit される', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');
      store.set(currentSessionIdAtom, 'session-123');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleKill();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_kill', {
        sessionId: 'session-123',
      });
    });

    it('socket が null のとき emit されない', () => {
      mockUseNospaceSocket.mockReturnValue(null);

      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');
      store.set(currentSessionIdAtom, 'session-123');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleKill();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('sessionId が null のとき emit されない', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');
      store.set(currentSessionIdAtom, null);

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleKill();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('非実行中のとき emit されない', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');
      store.set(currentSessionIdAtom, 'session-123');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleKill();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleSendStdin', () => {
    it('正常系で emit される', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');
      store.set(currentSessionIdAtom, 'session-456');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleSendStdin('input line\n');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('nospace_stdin', {
        sessionId: 'session-456',
        data: 'input line\n',
      });
    });

    it('socket が null のとき emit されない', () => {
      mockUseNospaceSocket.mockReturnValue(null);

      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');
      store.set(currentSessionIdAtom, 'session-456');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleSendStdin('data');
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('sessionId が null のとき emit されない', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'running');
      store.set(currentSessionIdAtom, null);

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleSendStdin('data');
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('非実行中のとき emit されない', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(executionStatusAtom, 'idle');
      store.set(currentSessionIdAtom, 'session-456');

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleSendStdin('data');
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleClearOutput', () => {
    it('outputEntries が空になる', () => {
      const { store, wrapper } = createTestWrapper();
      store.set(outputEntriesAtom, [
        { type: 'stdout', data: 'line1', timestamp: 100 },
        { type: 'stderr', data: 'error', timestamp: 200 },
      ]);

      const { result } = renderHook(() => useNospaceExecution(), { wrapper });

      act(() => {
        result.current.handleClearOutput();
      });

      expect(store.get(outputEntriesAtom)).toEqual([]);
    });
  });
});
