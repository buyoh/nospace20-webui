import { atom } from 'jotai';

const defaultCode = `func: puts(str) {
  while: *str != 0 {
    __putc(*str);
    str += 1;
  };
  __putc('\\n');
}

func: main() {
  let: g[12]("hello\\sworld");
  puts(&g);
  return: 0;
}
`;

/** エディタのソースコード */
export const sourceCodeAtom = atom<string>(defaultCode);
