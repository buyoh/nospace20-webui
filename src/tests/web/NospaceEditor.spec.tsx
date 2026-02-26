// Unit test: NospaceEditor の annotations prop が AceEditor に渡されること

import React from 'react';
import { render } from '@testing-library/react';
import type { Ace } from 'ace-builds';

// react-ace をモックし、渡された props をキャプチャする
let capturedProps: Record<string, any> = {};

jest.mock('react-ace', () => {
  const MockAceEditor = (props: Record<string, any>) => {
    capturedProps = props;
    return <div data-testid="mock-ace-editor" />;
  };
  MockAceEditor.displayName = 'MockAceEditor';
  return MockAceEditor;
});

// ace-builds の theme/mode インポートをスタブ
jest.mock('ace-builds/src-noconflict/theme-monokai', () => ({}));
// nospace-ace-mode は相対インポートのためモックが必要
jest.mock('../../web/libs/nospace20/nospace-ace-mode', () => ({}));

// NospaceEditor は mock セットアップ後に import する
import { NospaceEditor } from '../../web/components/editor/NospaceEditor';

describe('NospaceEditor', () => {
  beforeEach(() => {
    capturedProps = {};
  });

  it('annotations prop が渡されない場合 undefined が AceEditor に渡される', () => {
    render(<NospaceEditor value="code" onChange={() => {}} />);
    expect(capturedProps.annotations).toBeUndefined();
  });

  it('annotations prop が AceEditor に渡されること', () => {
    const annotations: Ace.Annotation[] = [
      { row: 2, column: 0, text: 'syntax error', type: 'error' },
    ];
    render(<NospaceEditor value="code" onChange={() => {}} annotations={annotations} />);
    expect(capturedProps.annotations).toEqual(annotations);
  });

  it('空の annotations 配列も AceEditor に渡されること', () => {
    const annotations: Ace.Annotation[] = [];
    render(<NospaceEditor value="code" onChange={() => {}} annotations={annotations} />);
    expect(capturedProps.annotations).toEqual([]);
  });
});
