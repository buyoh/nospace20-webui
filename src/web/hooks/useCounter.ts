import { useAtom } from 'jotai';
import { useEffect, useCallback } from 'react';
import { counterAtom } from '../stores/counterAtom';
import {
  socketAtom,
  connectionStatusAtom,
  connectionErrorAtom,
  createSocket,
  AppSocket,
} from '../stores/socketAtom';

export interface UseCounterReturn {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  connectionError: string | null;
}

export function useCounter(): UseCounterReturn {
  const [count, setCount] = useAtom(counterAtom);
  const [socket, setSocket] = useAtom(socketAtom);
  const [connectionStatus, setConnectionStatus] = useAtom(connectionStatusAtom);
  const [connectionError, setConnectionError] = useAtom(connectionErrorAtom);

  useEffect(() => {
    // Socket接続を作成
    const newSocket: AppSocket = createSocket();
    setSocket(newSocket);

    // 接続成功時
    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      setConnectionError(null);
    });

    // 切断時
    newSocket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    // 接続エラー時
    newSocket.on('connect_error', (error) => {
      setConnectionStatus('error');
      setConnectionError(error.message);
    });

    // サーバーからカウンター更新を受信
    newSocket.on('counter_update', (state) => {
      setCount(state.value);
    });

    // クリーンアップ
    return () => {
      newSocket.disconnect();
      setSocket(null);
      setConnectionStatus('disconnected');
      setConnectionError(null);
    };
  }, [setSocket, setCount, setConnectionStatus, setConnectionError]);

  const increment = useCallback(() => {
    socket?.emit('counter_increment');
  }, [socket]);

  const decrement = useCallback(() => {
    socket?.emit('counter_decrement');
  }, [socket]);

  const reset = useCallback(() => {
    socket?.emit('counter_reset');
  }, [socket]);

  return {
    count,
    increment,
    decrement,
    reset,
    connectionStatus,
    connectionError,
  };
}
