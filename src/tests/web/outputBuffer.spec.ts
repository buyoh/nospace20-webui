import {
  appendOutputEntry,
  OUTPUT_OMITTED_MESSAGE,
} from '../../web/libs/outputBuffer';
import type { OutputEntry } from '../../interfaces/NospaceTypes';

const out = (data: string): OutputEntry => ({
  type: 'stdout',
  data,
  timestamp: 0,
});
const sys = (data: string): OutputEntry => ({
  type: 'system',
  data,
  timestamp: 0,
});

describe('appendOutputEntry', () => {
  it('同じ type が続く場合は 1 エントリに連結する', () => {
    let entries: OutputEntry[] = [];
    entries = appendOutputEntry(entries, out('a'));
    entries = appendOutputEntry(entries, out('b'));
    entries = appendOutputEntry(entries, sys('s'));
    entries = appendOutputEntry(entries, out('c'));

    expect(entries.map((e) => `${e.type}:${e.data}`)).toEqual([
      'stdout:ab',
      'system:s',
      'stdout:c',
    ]);
  });

  it('元の配列を変更しない', () => {
    const prev = [out('a')];
    appendOutputEntry(prev, out('b'));

    expect(prev).toEqual([out('a')]);
  });

  it('上限を超えると古い出力を捨て、最新が残り、省略マーカーが先頭に 1 つだけ付く', () => {
    const limits = { maxChars: 10 };
    let entries: OutputEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries = appendOutputEntry(entries, out('0123456789'), limits);
    }

    const markers = entries.filter((e) => e.data === OUTPUT_OMITTED_MESSAGE);
    expect(markers).toHaveLength(1);
    expect(entries[0].data).toBe(OUTPUT_OMITTED_MESSAGE);
    const body = entries.slice(1).reduce((s, e) => s + e.data, '');
    // 上限以内に収まり、最新の出力が残る
    expect(body.length).toBeLessThanOrEqual(10);
    expect(body.length).toBeGreaterThan(0);
    expect(body.endsWith('0123456789'.slice(-body.length))).toBe(true);
  });

  it('上限を超えたときは上限より余裕を持って削り、次の追記では削らない（毎回の全文再生成を避ける）', () => {
    const limits = { maxChars: 100 };
    let entries = appendOutputEntry([], out('x'.repeat(100)), limits);
    expect(entries).toHaveLength(1); // ちょうど上限なら削らない

    entries = appendOutputEntry(entries, out('y'), limits); // 101 文字 → 80 文字まで削る
    const bodyLength = () =>
      entries.slice(1).reduce((s, e) => s + e.data.length, 0);
    expect(bodyLength()).toBe(80);

    entries = appendOutputEntry(entries, out('z'), limits);
    expect(bodyLength()).toBe(81); // 余裕があるため、まだ削らない
  });

  it('system エントリは上限内なら残り、古い stdout だけが捨てられる', () => {
    const limits = { maxChars: 8 };
    let entries: OutputEntry[] = [];
    entries = appendOutputEntry(entries, out('aaaa'), limits);
    entries = appendOutputEntry(entries, sys('KILL'), limits);
    entries = appendOutputEntry(entries, out('bbbbbb'), limits);

    const text = entries.map((e) => e.data).join('|');
    expect(text.endsWith('bbbbbb')).toBe(true);
    expect(entries[0].data).toBe(OUTPUT_OMITTED_MESSAGE);
  });

  it('サロゲートペアの途中で切らない', () => {
    const limits = { maxChars: 3 };
    // 😀 は 2 コードユニット。"a😀😀" は 5 文字
    const entries = appendOutputEntry([], out('a😀😀'), limits);

    const body = entries.slice(1).reduce((s, e) => s + e.data, '');
    // 3 文字に収めるため、先頭の 'a' と 😀 の途中を捨てて "😀" のみ（またはペアごと）残る
    expect(body === '😀' || body === '😀😀').toBe(true);
    expect(body.length).toBeLessThanOrEqual(3);
  });

  it('上限内ならマーカーを付けない', () => {
    const entries = appendOutputEntry([], out('abc'), { maxChars: 10 });

    expect(entries).toHaveLength(1);
  });
});
