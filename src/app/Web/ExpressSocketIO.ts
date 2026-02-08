import * as SocketIO from 'socket.io';
import Http from 'http';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../interfaces/CounterTypes';
import { CounterService } from '../Services/CounterService';
import { createCounterController } from '../Controllers/CounterController';

export async function bindSocketIOToExpress(
  counterService: CounterService,
  httpServer: Http.Server
): Promise<void> {
  const io = new SocketIO.Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer
  );

  // ブロードキャスト関数を定義
  const broadcast = (state: { value: number }) => {
    io.emit('counter_update', state);
  };

  // コントローラーを作成
  const controller = createCounterController(counterService, broadcast);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // 接続時に現在のカウンター値を送信
    socket.emit('counter_update', controller.getCurrentState());

    socket.on('counter_increment', () => {
      controller.handleIncrement();
    });

    socket.on('counter_decrement', () => {
      controller.handleDecrement();
    });

    socket.on('counter_reset', () => {
      controller.handleReset();
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
