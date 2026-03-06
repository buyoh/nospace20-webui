// Unit test: EditorContainer が compileErrorsAtom を Ace.Annotation[] に変換して
// NospaceEditor に渡すことを確認する

import React from 'react';
import { render } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import type { Ace } from 'ace-builds';
import { compileErrorsAtom } from '../../web/stores/compileErrorsAtom';
import type { NospaceErrorEntry } from '../../web/libs/formatNospaceErrors';

// NospaceEditorComponent prop 経由で注入するフェイクコンポーネント（jest.mock() 不要）
let capturedAnnotations: Ace.Annotation[] | undefined;

const MockNospaceEditor = (props: { value: string; onChange: () => void; annotations?: Ace.Annotation[] }) => {
  capturedAnnotations = props.annotations;
  return <div data-testid="mock-nospace-editor" />;
};

// useTestEditor hook の DI 差し替え（API 通信なし）
const fakeUseTestEditor = () => ({ updateSource: () => {} });

import { EditorContainer } from '../../web/containers/EditorContainer';

function renderWithStore(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <EditorContainer
        NospaceEditorComponent={MockNospaceEditor as any}
        useTestEditorHook={fakeUseTestEditor}
      />
    </Provider>,
  );
}

describe('EditorContainer', () => {
  beforeEach(() => {
    capturedAnnotations = undefined;
  });

  it('コンパイルエラーがない場合、空の annotations が渡される', () => {
    const store = createStore();
    renderWithStore(store);
    expect(capturedAnnotations).toEqual([]);
  });

  it('line あり エラーが 0-based row に変換されて渡される', () => {
    const store = createStore();
    const errors: NospaceErrorEntry[] = [
      { message: 'syntax error', line: 3, column: 5 },
      { message: 'undefined variable', line: 1 },
    ];
    store.set(compileErrorsAtom, errors);
    renderWithStore(store);

    expect(capturedAnnotations).toEqual([
      { row: 2, column: 5, text: 'syntax error', type: 'error' },
      { row: 0, column: 0, text: 'undefined variable', type: 'error' },
    ]);
  });

  it('line なし エラーはアノテーションから除外される', () => {
    const store = createStore();
    const errors: NospaceErrorEntry[] = [
      { message: 'no location error' }, // line undefined
      { message: 'with location', line: 2, column: 1 },
    ];
    store.set(compileErrorsAtom, errors);
    renderWithStore(store);

    expect(capturedAnnotations).toEqual([
      { row: 1, column: 1, text: 'with location', type: 'error' },
    ]);
  });

  it('column なし エラーは column: 0 としてアノテーションに含まれる', () => {
    const store = createStore();
    const errors: NospaceErrorEntry[] = [
      { message: 'no column error', line: 5 },
    ];
    store.set(compileErrorsAtom, errors);
    renderWithStore(store);

    expect(capturedAnnotations).toEqual([
      { row: 4, column: 0, text: 'no column error', type: 'error' },
    ]);
  });

  it('details ありエラーはアノテーションの text に details が含まれる', () => {
    const store = createStore();
    const errors: NospaceErrorEntry[] = [
      { message: 'type mismatch', line: 2, column: 4, details: 'expected int, got string' },
    ];
    store.set(compileErrorsAtom, errors);
    renderWithStore(store);

    expect(capturedAnnotations).toEqual([
      { row: 1, column: 4, text: 'type mismatch\nexpected int, got string', type: 'error' },
    ]);
  });

  it('details なしエラーはアノテーションの text に message のみ', () => {
    const store = createStore();
    const errors: NospaceErrorEntry[] = [
      { message: 'simple error', line: 1 },
    ];
    store.set(compileErrorsAtom, errors);
    renderWithStore(store);

    expect(capturedAnnotations).toEqual([
      { row: 0, column: 0, text: 'simple error', type: 'error' },
    ]);
  });
});
