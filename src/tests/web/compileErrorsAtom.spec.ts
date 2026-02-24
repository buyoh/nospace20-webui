// Unit test: compileErrorsAtom の初期値確認

import { createStore } from 'jotai';
import { compileErrorsAtom } from '../../web/stores/compileErrorsAtom';

describe('compileErrorsAtom', () => {
  it('初期値が空配列であること', () => {
    const store = createStore();
    expect(store.get(compileErrorsAtom)).toEqual([]);
  });

  it('エラー配列をセット・取得できること', () => {
    const store = createStore();
    const errors = [
      { message: 'syntax error', line: 3, column: 5 },
      { message: 'unknown token' },
    ];
    store.set(compileErrorsAtom, errors);
    expect(store.get(compileErrorsAtom)).toEqual(errors);
  });
});
