import { atomWithStorage } from 'jotai/utils';

// BUG FIX: エントリポイント関数名を main → __main に修正。
// nospace 言語のエントリポイントは __main であり、CLI・WASM 双方とも
// __main を要求する。main だと "function '__main' not found" エラーになる。
export const defaultCode = `func: puts(str) {
  while: *str != 0 {
    __putc(*str);
    str += 1;
  };
  __putc('\\n');
}

func: __main() {
  let: g[12]("hello\\sworld");
  puts(&g);
  return: 0;
}
`;

/** エディタのソースコード（localStorage に永続化） */
export const sourceCodeAtom = atomWithStorage<string>('nospace-source-code', defaultCode);
