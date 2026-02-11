import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useNospaceSocket } from '../../web/hooks/useNospaceSocket';
import { socketAtom } from '../../web/stores/socketAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../../web/stores/executionAtom';
import type { AppSocket } from '../../web/stores/socketAtom';
import type {
  NospaceServerToClientEvents,
  OutputEntry,
} from '../../interfaces/NospaceTypes';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { io } = require('socket.io-client');

type EventHandlers = {
  [K in keyof NospaceServerToClientEvents]?: Array<
    NospaceServerToClientEvents[K]
  >;
} & {
  connect?: Array<() => void>;
  connect_error?: Array<(error: Error) => void>;
  disconnect?: Array<(reason: string) => void>;
};

function createMockSocket() {
  const handlers: EventHandlers = {};

  const mockSocket = {
    id: 'mock-socket-id',
    on: jest.fn((event: string, handler: Function) => {
      if (!handlers[event as keyof EventHandlers]) {
        handlers[event as keyof EventHandlers] = [] as any;
      }
      (handlers[event as keyof EventHandlers] as any).push(handler);
      return mockSocket;
    }),
    emit: jest.fn(),
    close: jest.fn(),
    // Test helper: trigger event
    _trigger(event: string, ...args: unknown[]) {
      const eventHandlers = handlers[event as keyof EventHandlers];
      if (eventHandlers) {
        eventHandlers.forEach((handler: any) => handler(...args));
      }
    },
  };

  return mockSocket as unknown as jest.Mocked<AppSocket> & {
    _trigger: (event: string, ...args: unknown[]) => void;
  };
}

function createTestWrapper() {
  const store = createStore();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, wrapper };
}

describe('useNospaceSocket', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('初回レンダリングで socket が作成される', () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useNospaceSocket(), { wrapper });

    expect(io).toHaveBeenCalled();
    expect(store.get(socketAtom)).toBe(mockSocket);
  });

  it('nospace_stdout イベントで outputEntries に追加', () => {
    const { store, wrapper } = createTestWrapper();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);

    renderHook(() => useNospaceSocket(), { wrapper });

    act(() => {
      mockSocket._trigger('nospace_stdout', {
        sessionId: 'session-1',
        data: 'Hello, world!\n',
      });
    });

    const entries = store.get(outputEntriesAtom);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'stdout',
      data: 'Hello, world!\n',
      timestamp: 12345,
    });

    dateNowSpy.mockRestore();
  });

  it('nospace_stderr イベントで outputEntries に追加', () => {
    const { store, wrapper } = createTestWrapper();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(54321);

    renderHook(() => useNospaceSocket(), { wrapper });

    act(() => {
      mockSocket._trigger('nospace_stderr', {
        sessionId: 'session-2',
        data: 'Error occurred\n',
      });
    });

    const entries = store.get(outputEntriesAtom);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'stderr',
      data: 'Error occurred\n',
      timestamp: 54321,
    });

    dateNowSpy.mockRestore();
  });

  it('nospace_execution_status: running', () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useNospaceSocket(), { wrapper });

    act(() => {
      mockSocket._trigger('nospace_execution_status', {
        sessionId: 'session-run',
        status: 'running',
      });
    });

    expect(store.get(executionStatusAtom)).toBe('running');
    expect(store.get(currentSessionIdAtom)).toBe('session-run');

    // system メッセージが追加されることを確認
    const entries = store.get(outputEntriesAtom);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('system');
    expect(entries[0].data).toContain('[Process started: session-run]');
  });

  it('nospace_execution_status: finished', () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useNospaceSocket(), { wrapper });

    act(() => {
      mockSocket._trigger('nospace_execution_status', {
        sessionId: 'session-finish',
        status: 'finished',
        exitCode: 0,
      });
    });

    expect(store.get(executionStatusAtom)).toBe('finished');
    expect(store.get(currentSessionIdAtom)).toBe('session-finish');
    expect(store.get(exitCodeAtom)).toBe(0);

    // system メッセージが追加されることを確認
    const entries = store.get(outputEntriesAtom);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('system');
    expect(entries[0].data).toContain('[Process exited with code: 0]');
  });

  it('nospace_execution_status: killed', () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useNospaceSocket(), { wrapper });

    act(() => {
      mockSocket._trigger('nospace_execution_status', {
        sessionId: 'session-kill',
        status: 'killed',
      });
    });

    expect(store.get(executionStatusAtom)).toBe('killed');
    expect(store.get(currentSessionIdAtom)).toBe('session-kill');

    // system メッセージが追加されることを確認
    const entries = store.get(outputEntriesAtom);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('system');
    expect(entries[0].data).toContain('[Process killed]');
  });

  it('nospace_execution_status: error', () => {
    const { store, wrapper } = createTestWrapper();

    renderHook(() => useNospaceSocket(), { wrapper });

    act(() => {
      mockSocket._trigger('nospace_execution_status', {
        sessionId: 'session-error',
        status: 'error',
      });
    });

    expect(store.get(executionStatusAtom)).toBe('error');
    expect(store.get(currentSessionIdAtom)).toBe('session-error');

    // system メッセージが追加されることを確認
    const entries = store.get(outputEntriesAtom);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('system');
    expect(entries[0].data).toContain('[Process error]');
  });

  it('アンマウント時に socket.close() が呼ばれる', () => {
    const { wrapper } = createTestWrapper();

    const { unmount } = renderHook(() => useNospaceSocket(), { wrapper });

    unmount();

    expect(mockSocket.close).toHaveBeenCalled();
  });
});
