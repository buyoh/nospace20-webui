import * as SocketIO from 'socket.io';
import Http from 'http';
import {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
} from '../../interfaces/NospaceTypes';
import { NospaceController } from '../Controllers/NospaceController';
import type { NospaceExecutionService } from '../Services/NospaceExecutionService';

/**
 * Socket.IO サーバを HTTP サーバに結び付ける。
 * @param executionService 実行サービス（設定を持つため、呼び出し側が組み立てて渡す）
 * @returns 生成した Socket.IO サーバ（終了処理で close するため）
 */
export async function bindSocketIOToExpress(
  httpServer: Http.Server,
  executionService: NospaceExecutionService
): Promise<SocketIO.Server> {
  const io = new SocketIO.Server<
    NospaceClientToServerEvents,
    NospaceServerToClientEvents
  >(httpServer);

  const nospaceController = new NospaceController(executionService);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    nospaceController.handleConnection(socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
