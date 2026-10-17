import type { OutputEntry } from '../../interfaces/NospaceTypes';

/** 出力パネルが保持する量の上限 */
export interface OutputLimits {
  /** 保持する合計文字数の上限 */
  maxChars: number;
}

/** 既定の保持上限（合計文字数） */
export const DEFAULT_OUTPUT_LIMITS: OutputLimits = { maxChars: 1_000_000 };

/** 上限超過時に削って残す割合（上限に対する比）。小さい chunk の高頻度追記で毎回削らないための余裕 */
const TRIM_TARGET_RATIO = 0.8;

/** 古い出力を捨てたことを示すマーカーエントリの本文 */
export const OUTPUT_OMITTED_MESSAGE = '[Earlier output omitted]\n';

function isOmittedMarker(entry: OutputEntry | undefined): boolean {
  return entry?.type === 'system' && entry.data === OUTPUT_OMITTED_MESSAGE;
}

/** 文字列の末尾から maxChars 文字を取る。サロゲートペアの途中では切らない */
function takeTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let start = text.length - maxChars;
  const code = text.charCodeAt(start);
  // 先頭が下位サロゲート（ペアの後半）なら、ペアごと捨てる
  if (code >= 0xdc00 && code <= 0xdfff) start += 1;
  return text.slice(start);
}

/**
 * 出力エントリを追加した新しい配列を返す（純粋関数）。
 *
 * - 直前と同じ type のエントリは data を連結して 1 エントリにまとめる（DOM 数の抑制）
 * - 合計文字数が上限を超えたら、先頭から古い出力を捨てて上限内に収め、
 *   先頭に省略マーカー（type: 'system'）を 1 つだけ置く。最新の出力は残る
 *
 * 無限に出力するプログラムでもブラウザのメモリと DOM が際限なく増えないようにするための上限であり、
 * 実行自体は止めない。省略マーカーは合計文字数に数えない。
 *
 * 上限ちょうどまで削ると、以降は追記のたびに全文（最大 maxChars 文字）を再生成することになり、
 * 小さい chunk を高頻度で出すプログラムでタブが重くなる。そのため上限を超えたときは
 * TRIM_TARGET_RATIO まで一度に削り、次に削るまでの間は追記を軽量に保つ。
 */
export function appendOutputEntry(
  prev: OutputEntry[],
  entry: OutputEntry,
  limits: OutputLimits = DEFAULT_OUTPUT_LIMITS
): OutputEntry[] {
  const next = prev.slice();
  const last = next[next.length - 1];
  if (last && last.type === entry.type && !isOmittedMarker(last)) {
    next[next.length - 1] = { ...last, data: last.data + entry.data };
  } else {
    next.push(entry);
  }

  const hasMarker = isOmittedMarker(next[0]);
  const body = hasMarker ? next.slice(1) : next;
  const total = body.reduce((sum, e) => sum + e.data.length, 0);
  if (total <= limits.maxChars) return next;

  // 先頭から古いエントリを捨てる。境界のエントリは後半だけ残す
  let overflow = total - Math.floor(limits.maxChars * TRIM_TARGET_RATIO);
  const kept: OutputEntry[] = [];
  for (const e of body) {
    if (overflow <= 0) {
      kept.push(e);
    } else if (e.data.length <= overflow) {
      overflow -= e.data.length;
    } else {
      kept.push({ ...e, data: takeTail(e.data, e.data.length - overflow) });
      overflow = 0;
    }
  }

  const marker: OutputEntry = {
    type: 'system',
    data: OUTPUT_OMITTED_MESSAGE,
    timestamp: entry.timestamp,
  };
  return [marker, ...kept];
}
