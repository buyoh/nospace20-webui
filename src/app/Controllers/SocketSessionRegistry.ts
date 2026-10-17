/** ソケットが現在保持している実行セッションと、その起因となった要求 */
export interface SocketSessionEntry {
  sessionId: string;
  requestId: string;
}

/**
 * ソケットごとの実行中セッション（と起因 requestId）を管理する。
 *
 * BUG FIX: 以前は onExit が `sessionsBySocket.delete(socket.id)` を無条件に実行していたため、
 * 同じソケットで再実行したとき、旧セッションの close が新セッションの登録を消していた。
 * 解決策として、登録中の sessionId が一致する場合のみ削除する。
 */
export class SocketSessionRegistry {
  private entries = new Map<string, SocketSessionEntry>();

  set(socketId: string, entry: SocketSessionEntry): void {
    this.entries.set(socketId, entry);
  }

  get(socketId: string): SocketSessionEntry | undefined {
    return this.entries.get(socketId);
  }

  /** 登録中の sessionId が一致する場合のみ削除する */
  deleteIfMatch(socketId: string, sessionId: string): void {
    if (this.entries.get(socketId)?.sessionId === sessionId) {
      this.entries.delete(socketId);
    }
  }

  delete(socketId: string): void {
    this.entries.delete(socketId);
  }

  /** 指定のセッションがこのソケットのものか */
  isOwner(socketId: string, sessionId: string): boolean {
    return this.entries.get(socketId)?.sessionId === sessionId;
  }
}
