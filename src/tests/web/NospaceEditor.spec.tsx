// Unit test: NospaceEditor の annotations prop が AceEditor に渡されること

import React from 'react';
import { render } from '@testing-library/react';
import type { Ace } from 'ace-builds';

// AceEditorComponent prop 経由で注入するフェイク AceEditor
// jest.mock() を使わず、プレーン React コンポーネントで props をキャプチャする
let capturedProps: Record<string, any> = {};

const MockAceEditor = (props: Record<string, any>) => {
  capturedProps = props;
  return <div data-testid="mock-ace-editor" />;
};
MockAceEditor.displayName = 'MockAceEditor';

// NospaceEditor は AceEditorComponent prop 経由で MockAceEditor を注入するため
// jest.mock() は不要
import { NospaceEditor } from '../../web/components/editor/NospaceEditor';

describe('NospaceEditor', () => {
  beforeEach(() => {
    capturedProps = {};
  });

  it('annotations prop が渡されない場合 undefined が AceEditor に渡される', () => {
    render(<NospaceEditor value="code" onChange={() => {}} AceEditorComponent={MockAceEditor} />);
    expect(capturedProps.annotations).toBeUndefined();
  });

  it('annotations prop が AceEditor に渡されること', () => {
    const annotations: Ace.Annotation[] = [
      { row: 2, column: 0, text: 'syntax error', type: 'error' },
    ];
    render(<NospaceEditor value="code" onChange={() => {}} annotations={annotations} AceEditorComponent={MockAceEditor} />);
    expect(capturedProps.annotations).toEqual(annotations);
  });

  it('空の annotations 配列も AceEditor に渡されること', () => {
    const annotations: Ace.Annotation[] = [];
    render(<NospaceEditor value="code" onChange={() => {}} annotations={annotations} AceEditorComponent={MockAceEditor} />);
    expect(capturedProps.annotations).toEqual([]);
  });
});
