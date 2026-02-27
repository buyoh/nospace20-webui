/**
 * Whitespace コード可視化ユーティリティ。
 * ws / ex-ws ターゲット出力の不可視文字（スペース・タブ・改行）を
 * 可視トークン（SP / TB / LF）に変換する機能を提供する。
 */

/**
 * Whitespace の不可視文字を可視トークンに変換する。
 *
 * 変換ルール:
 *   スペース (U+0020) → "SP"
 *   タブ (U+0009)     → "TB"
 *   改行 (U+000A)     → "LF\n"
 *
 * 改行は "LF" トークンの後に実際の改行文字も付加し、行構造を維持する。
 * ws / ex-ws ターゲット以外の文字が含まれる場合はそのまま出力する。
 */
export function formatWhitespaceVisible(input: string): string {
  let result = '';
  for (const ch of input) {
    switch (ch) {
      case ' ':
        result += 'SP';
        break;
      case '\t':
        result += 'TB';
        break;
      case '\n':
        result += 'LF\n';
        break;
      default:
        result += ch;
        break;
    }
  }
  return result;
}

/**
 * 対象のコンパイルターゲットが Whitespace 可視化対象かどうかを判定する。
 * ws および ex-ws ターゲットの出力は不可視文字で構成されるため可視化対象となる。
 */
export function isWhitespaceTarget(target: string): boolean {
  return target === 'ws' || target === 'ex-ws';
}
