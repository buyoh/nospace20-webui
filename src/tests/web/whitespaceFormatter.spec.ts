import {
  formatWhitespaceVisible,
  isWhitespaceTarget,
} from '../../web/libs/whitespaceFormatter';

describe('formatWhitespaceVisible', () => {
  it('空文字列の場合、空文字列を返す', () => {
    expect(formatWhitespaceVisible('')).toBe('');
  });

  it('スペースを "SP" に変換する', () => {
    expect(formatWhitespaceVisible(' ')).toBe('SP');
  });

  it('タブを "TB" に変換する', () => {
    expect(formatWhitespaceVisible('\t')).toBe('TB');
  });

  it('改行を "LF\\n" に変換する（行構造を維持）', () => {
    expect(formatWhitespaceVisible('\n')).toBe('LF\n');
  });

  it('複数のスペースを連続する SP に変換する', () => {
    expect(formatWhitespaceVisible('  ')).toBe('SPSP');
    expect(formatWhitespaceVisible('   ')).toBe('SPSPSP');
  });

  it('スペース・タブ・改行の混合文字列を変換する', () => {
    expect(formatWhitespaceVisible(' \t\n')).toBe('SPTBLF\n');
  });

  it('ws ターゲット出力を正しく変換する', () => {
    // "  \t\n \t \n" → "SPSPTBLF\nSPTBSPLF\n"
    expect(formatWhitespaceVisible('  \t\n \t \n')).toBe(
      'SPSPTBLF\nSPTBSPLF\n'
    );
  });

  it('対象外の文字はそのまま通過させる（ex-ws 等）', () => {
    expect(formatWhitespaceVisible('abc\n')).toBe('abcLF\n');
  });

  it('連続した改行を変換する', () => {
    expect(formatWhitespaceVisible('\n\n')).toBe('LF\nLF\n');
  });
});

describe('isWhitespaceTarget', () => {
  it('"ws" ターゲットで true を返す', () => {
    expect(isWhitespaceTarget('ws')).toBe(true);
  });

  it('"ex-ws" ターゲットで true を返す', () => {
    expect(isWhitespaceTarget('ex-ws')).toBe(true);
  });

  it('"mnemonic" ターゲットで false を返す', () => {
    expect(isWhitespaceTarget('mnemonic')).toBe(false);
  });

  it('"json" ターゲットで false を返す', () => {
    expect(isWhitespaceTarget('json')).toBe(false);
  });

  it('空文字列で false を返す', () => {
    expect(isWhitespaceTarget('')).toBe(false);
  });
});
