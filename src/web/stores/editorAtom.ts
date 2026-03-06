import { atomWithStorage } from 'jotai/utils';


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
