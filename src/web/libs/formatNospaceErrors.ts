/**
 * nospace バイナリが出力するエラー JSON を整形するユーティリティ。
 *
 * サーバー側・WASM 側の両方で使われるエラーフォーマット
 * `{ success: false, errors: [{ message, line?, column? }] }` を
 * 人間が読みやすいメッセージに変換する。
 */

/** nospace エラー JSON に含まれる個別エラー */
export interface NospaceErrorEntry {
  message: string;
  line?: number;
  column?: number;
}

/** nospace エラー JSON の構造 */
interface NospaceErrorResult {
  success: false;
  errors: NospaceErrorEntry[];
}

/**
 * NospaceErrorEntry 配列を人間が読みやすい文字列に変換する。
 *
 * 各エラーは `message` のみの場合はそのまま、
 * `line` / `column` がある場合は `:line:column` を付与する。
 * 複数エラーは改行で連結される。
 */
export function formatErrorEntries(errors: NospaceErrorEntry[]): string {
  return errors
    .map((e) => {
      const loc =
        e.line != null
          ? `:${e.line}${e.column != null ? ':' + e.column : ''}`
          : '';
      return `${e.message}${loc}`;
    })
    .join('\n');
}

/**
 * 文字列を nospace エラー JSON としてパースし、整形されたメッセージを返す。
 *
 * パースに失敗した場合やエラーフォーマットに一致しない場合は null を返す。
 */
export function tryFormatNospaceErrorJson(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isNospaceErrorResult(parsed)) {
    return null;
  }

  return formatErrorEntries(parsed.errors);
}

/** 値が NospaceErrorResult であるかを判定する型ガード */
export function isNospaceErrorResult(value: unknown): value is NospaceErrorResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.success !== false) return false;
  if (!Array.isArray(obj.errors)) return false;
  return obj.errors.every(
    (e: unknown) =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).message === 'string',
  );
}
