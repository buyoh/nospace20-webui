import * as SocketIO from 'socket.io';
import Http from 'http';
import {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
} from '../../interfaces/NospaceTypes';
import { NospaceController } from '../Controllers/NospaceController';

export async function bindSocketIOToExpress(
  httpServer: Http.Server
): Promise<void> {
  const io = new SocketIO.Server<
    NospaceClientToServerEvents,
    NospaceServerToClientEvents
  >(httpServer);

  const nospaceController = new NospaceController();

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    nospaceController.handleConnection(socket);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
