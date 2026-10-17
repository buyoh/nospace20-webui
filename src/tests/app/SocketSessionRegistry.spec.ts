import { SocketSessionRegistry } from '../../app/Controllers/SocketSessionRegistry';

describe('SocketSessionRegistry', () => {
  it('登録した sessionId と requestId を取得でき、所有者を判定できる', () => {
    const registry = new SocketSessionRegistry();
    registry.set('s1', { sessionId: 'a', requestId: 'r1' });

    expect(registry.get('s1')).toEqual({ sessionId: 'a', requestId: 'r1' });
    expect(registry.isOwner('s1', 'a')).toBe(true);
    expect(registry.isOwner('s1', 'b')).toBe(false);
    expect(registry.isOwner('s2', 'a')).toBe(false);
  });

  it('BUG: deleteIfMatch は sessionId が一致する場合のみ削除する', () => {
    const registry = new SocketSessionRegistry();
    registry.set('s1', { sessionId: 'new', requestId: 'r2' });

    // 旧セッションの終了通知が新セッションの登録を消してはならない
    registry.deleteIfMatch('s1', 'old');
    expect(registry.get('s1')?.sessionId).toBe('new');

    registry.deleteIfMatch('s1', 'new');
    expect(registry.get('s1')).toBeUndefined();
  });
});
