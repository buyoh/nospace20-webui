import { defaultCode } from '../stores/editorAtom';

/** エディタ上で選択できるサンプルプログラムの型 */
export interface EditorSample {
  /** サンプルの表示名 */
  name: string;
  /** サンプルのソースコード */
  code: string;
}

/** 組み込みサンプルプログラム一覧 */
export const editorSamples: EditorSample[] = [
  {
    name: 'Hello World',
    code: defaultCode,
  },
  {
    name: 'Quick sort',
    code: `
func: swap(p, q) {
    let: t;
    t = *p; *p = *q; *q = t;
}
func: qsort(begin, end), alias: func: compare(l,r) {
    if: end - begin <= 1 { return:; };
    let: pv(begin), it(begin + 1);
    while: it < end {
        if: !compare(*pv, *it) {
            swap(pv + 1, it);
            swap(pv, pv + 1);
            pv += 1;
        };
        it += 1;
    };
    qsort(begin, pv);
    qsort(pv+1, end);
}

func: lesser(l, r) {
  return: l < r;
}

func: greater(l, r) {
  return: l > r;
}

alias: puti(__puti);
alias: putc(__putc);

alias: qsort_le(qsort, lesser);
alias: qsort_ge(qsort, greater);

func: __main() {
    let: arr[]([3,1,4,1,5,9,2,6,5]);
    qsort_le(&arr, &arr+9);
    repeat: i(0), 9, {
        puti(arr[i]);
        putc('\\s');
    };
    let: arr2[]([3,1,4,1,5,9,2,6,5]);
    qsort_ge(&arr2, &arr2+9);
    repeat: i(0), 9, {
        puti(arr2[i]);
        putc('\\s');
    };
}
`,
  },
  {
    name: 'Linked stack',
    code: `
let: tail(0);

func: push_back(val) {
  let: next(__alloc(2));
  (*next)[0] = tail;
  (*next)[1] = val;
  # *(next + 0) = tail; #
  # *(next + 1) = val; #
  tail = next;
}

func: pop_back() {
  if: tail == 0 {
    return: 0; 
  };
  let: val((*tail)[1]);
  let: p(tail);
  tail = (*tail)[0];
  __free(p);
  return: val;
}

func: __main() {
  for: {let: c(0); } {
    c = __getc();
    c > 32 && c != '$';
  } {} {
    if: '0' <= c && c <= '9' {
      push_back(c - '0');
    };
    if: c == 'p' {
      __puti(pop_back()); 
    };
  };
}`,
  },
];
