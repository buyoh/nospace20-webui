import { atom } from 'jotai';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../interfaces/CounterTypes';
import {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
} from '../../interfaces/NospaceTypes';

// Combine event types
type CombinedClientToServerEvents = ClientToServerEvents &
  NospaceClientToServerEvents;
type CombinedServerToClientEvents = ServerToClientEvents &
  NospaceServerToClientEvents;

export type AppSocket = Socket<
  CombinedServerToClientEvents,
  CombinedClientToServerEvents
>;

// Socket インスタンスを保持する atom
export const socketAtom = atom<AppSocket | null>(null);

// 実際の接続状態を保持する atom
export const connectionStatusAtom = atom<
  'connected' | 'disconnected' | 'error'
>('disconnected');

// 接続エラーメッセージを保持する atom
export const connectionErrorAtom = atom<string | null>(null);

// Socket 接続を作成
export function createSocket(): AppSocket {
  return io();
}
