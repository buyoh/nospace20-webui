import { atom } from 'jotai';

// Editor source code
const defaultCode = `func: main() {
  let: x(42);
  __clog(x);
}`;

export const sourceCodeAtom = atom<string>(defaultCode);
