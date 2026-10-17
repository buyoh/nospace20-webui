import type { Socket } from 'socket.io';
import type { OutputFlowControl } from '../Services/NospaceExecutionService';

/** engine.io の送信待ちバッファへの最小限のアクセス（writeBuffer は非公開 API のためここに閉じ込める） */
interface EngineConnection {
  writeBuffer?: unknown[];
  on(event: 'drain', listener: () => void): unknown;
  off(event: 'drain', listener: () => void): unknown;
}

/**
 * Socket.IO の送信待ちパケット数から出力の混雑を判定する OutputFlowControl 実装。
 * engine.io の writeBuffer はドキュメント化された API ではないため、依存をこのクラスに閉じ込める。
 * engine.io の更新時はこのクラスだけを確認すればよい。
 */
export class SocketFlowControl implements OutputFlowControl {
  constructor(
    private readonly socket: Socket,
    private readonly highWaterPackets = 64
  ) {}

  private get conn(): EngineConnection | undefined {
    return (this.socket as unknown as { conn?: EngineConnection }).conn;
  }

  isCongested(): boolean {
    return (this.conn?.writeBuffer?.length ?? 0) >= this.highWaterPackets;
  }

  onDrain(listener: () => void): () => void {
    const conn = this.conn;
    if (!conn) return () => {};
    conn.on('drain', listener);
    return () => {
      conn.off('drain', listener);
    };
  }
}
