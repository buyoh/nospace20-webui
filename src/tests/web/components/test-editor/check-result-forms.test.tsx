import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SuccessTraceForm } from '../../../../web/components/test-editor/check-result-forms/SuccessTraceForm';
import { SuccessIOForm } from '../../../../web/components/test-editor/check-result-forms/SuccessIOForm';
import { CompileErrorForm } from '../../../../web/components/test-editor/check-result-forms/CompileErrorForm';
import { ParseErrorForm } from '../../../../web/components/test-editor/check-result-forms/ParseErrorForm';
import type {
  SuccessTraceSchema,
  SuccessIOSingleSchema,
  SuccessIOMultiSchema,
  CompileErrorSchema,
  ParseErrorSchema,
} from '../../../../interfaces/CheckResultSchema';

// ------------------------------------------------
// SuccessTraceForm
// ------------------------------------------------
describe('SuccessTraceForm', () => {
  const makeSchema = (counts: number[]): SuccessTraceSchema => ({
    trace_hit_counts: counts,
  });

  it('trace_hit_counts の各値が number input として表示される', () => {
    render(
      <SuccessTraceForm schema={makeSchema([3, 7])} onChange={jest.fn()} />
    );

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('3');
    expect(inputs[1].value).toBe('7');
  });

  it('数値を変更すると onChange が正しいスキーマで呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(
      <SuccessTraceForm schema={makeSchema([1])} onChange={mockOnChange} />
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9' } });

    expect(mockOnChange).toHaveBeenCalledWith({ trace_hit_counts: [9] });
  });

  it('+ Add ボタンで要素が追加される', () => {
    const mockOnChange = jest.fn();
    render(
      <SuccessTraceForm schema={makeSchema([1, 2])} onChange={mockOnChange} />
    );

    fireEvent.click(screen.getByText('+ Add'));

    expect(mockOnChange).toHaveBeenCalledWith({
      trace_hit_counts: [1, 2, 1],
    });
  });

  it('× ボタンで指定した要素が削除される', () => {
    const mockOnChange = jest.fn();
    render(
      <SuccessTraceForm schema={makeSchema([10, 20])} onChange={mockOnChange} />
    );

    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith({ trace_hit_counts: [20] });
  });

  it('要素が 1 つのとき × ボタンが無効化される', () => {
    render(<SuccessTraceForm schema={makeSchema([5])} onChange={jest.fn()} />);

    const removeButton = screen.getByText('×');
    expect(removeButton).toBeDisabled();
  });

  it('disabled=true のとき入力・ボタンが無効化される', () => {
    render(
      <SuccessTraceForm
        schema={makeSchema([1])}
        onChange={jest.fn()}
        disabled
      />
    );

    expect(screen.getByRole('spinbutton')).toBeDisabled();
    expect(screen.getByText('+ Add')).toBeDisabled();
  });
});

// ------------------------------------------------
// SuccessIOForm (Single)
// ------------------------------------------------
describe('SuccessIOForm - Single モード', () => {
  const singleSchema: SuccessIOSingleSchema = {
    type: 'success_io',
    stdin: 'hello',
    stdout: 'world',
  };

  it('stdin / stdout のテキストエリアが表示される', () => {
    render(<SuccessIOForm schema={singleSchema} onChange={jest.fn()} />);

    expect(screen.getByText('Standard Input (stdin)')).toBeInTheDocument();
    expect(screen.getByText('Expected Output (stdout)')).toBeInTheDocument();
  });

  it('stdin を変更すると onChange が呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(<SuccessIOForm schema={singleSchema} onChange={mockOnChange} />);

    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
    // 最初のテキストエリアが stdin
    const stdinArea = textareas.find((t) => t.value === 'hello')!;
    fireEvent.change(stdinArea, { target: { value: 'new_stdin' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ stdin: 'new_stdin' })
    );
  });

  it('stdout を変更すると onChange が呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(<SuccessIOForm schema={singleSchema} onChange={mockOnChange} />);

    const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
    const stdoutArea = textareas.find((t) => t.value === 'world')!;
    fireEvent.change(stdoutArea, { target: { value: 'new_stdout' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ stdout: 'new_stdout' })
    );
  });

  it('Multiple Cases に切り替えると cases スキーマで onChange が呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(<SuccessIOForm schema={singleSchema} onChange={mockOnChange} />);

    const multipleRadio = screen.getByLabelText('Multiple Cases');
    fireEvent.click(multipleRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success_io',
        cases: expect.arrayContaining([
          expect.objectContaining({ stdin: 'hello', stdout: 'world' }),
        ]),
      })
    );
  });
});

// ------------------------------------------------
// SuccessIOForm (Multi)
// ------------------------------------------------
describe('SuccessIOForm - Multiple モード', () => {
  const multiSchema: SuccessIOMultiSchema = {
    type: 'success_io',
    cases: [
      { name: 'case1', stdin: 'in1', stdout: 'out1' },
      { name: 'case2', stdin: 'in2', stdout: 'out2' },
    ],
  };

  it('ケース一覧が表示される', () => {
    render(<SuccessIOForm schema={multiSchema} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('case1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('case2')).toBeInTheDocument();
  });

  it('+ Add Case ボタンで新しいケースが追加される', () => {
    const mockOnChange = jest.fn();
    render(<SuccessIOForm schema={multiSchema} onChange={mockOnChange} />);

    fireEvent.click(screen.getByText('+ Add Case'));

    const calledWith = mockOnChange.mock.calls[0][0] as SuccessIOMultiSchema;
    expect(calledWith.cases).toHaveLength(3);
  });

  it('× Remove ボタンで対象ケースが削除される', () => {
    const mockOnChange = jest.fn();
    render(<SuccessIOForm schema={multiSchema} onChange={mockOnChange} />);

    const removeButtons = screen.getAllByText('× Remove');
    fireEvent.click(removeButtons[0]);

    const calledWith = mockOnChange.mock.calls[0][0] as SuccessIOMultiSchema;
    expect(calledWith.cases).toHaveLength(1);
    expect(calledWith.cases[0].name).toBe('case2');
  });

  it('Single Case に切り替えると single スキーマで onChange が呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(<SuccessIOForm schema={multiSchema} onChange={mockOnChange} />);

    const singleRadio = screen.getByLabelText('Single Case');
    fireEvent.click(singleRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success_io',
        stdin: 'in1',
        stdout: 'out1',
      })
    );
  });
});

// ------------------------------------------------
// CompileErrorForm
// ------------------------------------------------
describe('CompileErrorForm', () => {
  const makeSchema = (contains: string[]): CompileErrorSchema => ({
    type: 'compile_error',
    contains,
  });

  it('contains の各文字列が input として表示される', () => {
    render(
      <CompileErrorForm
        schema={makeSchema(['err1', 'err2'])}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('err1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('err2')).toBeInTheDocument();
  });

  it('テキストを変更すると onChange が呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(
      <CompileErrorForm schema={makeSchema(['old'])} onChange={mockOnChange} />
    );

    fireEvent.change(screen.getByDisplayValue('old'), {
      target: { value: 'new' },
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ contains: ['new'] })
    );
  });

  it('+ Add ボタンで空文字列要素が追加される', () => {
    const mockOnChange = jest.fn();
    render(
      <CompileErrorForm schema={makeSchema(['a'])} onChange={mockOnChange} />
    );

    fireEvent.click(screen.getByText('+ Add'));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ contains: ['a', ''] })
    );
  });

  it('× ボタンで指定要素が削除される', () => {
    const mockOnChange = jest.fn();
    render(
      <CompileErrorForm
        schema={makeSchema(['x', 'y'])}
        onChange={mockOnChange}
      />
    );

    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ contains: ['y'] })
    );
  });

  it('要素が 1 つのとき × ボタンが無効化される', () => {
    render(
      <CompileErrorForm schema={makeSchema(['only'])} onChange={jest.fn()} />
    );

    expect(screen.getByText('×')).toBeDisabled();
  });

  it('disabled=true のとき入力が無効化される', () => {
    render(
      <CompileErrorForm
        schema={makeSchema(['e'])}
        onChange={jest.fn()}
        disabled
      />
    );

    expect(screen.getByDisplayValue('e')).toBeDisabled();
    expect(screen.getByText('+ Add')).toBeDisabled();
  });
});

// ------------------------------------------------
// ParseErrorForm
// ------------------------------------------------
describe('ParseErrorForm', () => {
  const makeSchema = (
    phase: 'tree' | 'tokenize',
    contains?: string[]
  ): ParseErrorSchema => ({ type: 'parse_error', phase, contains });

  it('phase ラジオボタンが表示され初期値が正しい (tree)', () => {
    render(<ParseErrorForm schema={makeSchema('tree')} onChange={jest.fn()} />);

    const treeRadio = screen.getByDisplayValue('tree') as HTMLInputElement;
    const tokenizeRadio = screen.getByDisplayValue(
      'tokenize'
    ) as HTMLInputElement;
    expect(treeRadio.checked).toBe(true);
    expect(tokenizeRadio.checked).toBe(false);
  });

  it('phase ラジオボタンが表示され初期値が正しい (tokenize)', () => {
    render(
      <ParseErrorForm schema={makeSchema('tokenize')} onChange={jest.fn()} />
    );

    expect(
      (screen.getByDisplayValue('tokenize') as HTMLInputElement).checked
    ).toBe(true);
  });

  it('phase を変更すると onChange が呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(
      <ParseErrorForm schema={makeSchema('tree')} onChange={mockOnChange} />
    );

    fireEvent.click(screen.getByDisplayValue('tokenize'));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'tokenize' })
    );
  });

  it('contains がないときは空のリストが表示される', () => {
    render(<ParseErrorForm schema={makeSchema('tree')} onChange={jest.fn()} />);

    // 要素が存在しないので + Add ボタンのみある
    expect(screen.getByText('+ Add')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('contains がある場合は各値が表示される', () => {
    render(
      <ParseErrorForm
        schema={makeSchema('tree', ['token error'])}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('token error')).toBeInTheDocument();
  });

  it('+ Add ボタンで contains に空文字列が追加される', () => {
    const mockOnChange = jest.fn();
    render(
      <ParseErrorForm schema={makeSchema('tree')} onChange={mockOnChange} />
    );

    fireEvent.click(screen.getByText('+ Add'));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ contains: [''] })
    );
  });

  it('× ボタンで最後の contains 要素を削除すると contains が undefined になる', () => {
    const mockOnChange = jest.fn();
    render(
      <ParseErrorForm
        schema={makeSchema('tree', ['msg'])}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('×'));

    const called = mockOnChange.mock.calls[0][0] as ParseErrorSchema;
    expect(called.contains).toBeUndefined();
  });

  it('contains が複数あるとき × ボタンで対象要素のみ削除される', () => {
    const mockOnChange = jest.fn();
    render(
      <ParseErrorForm
        schema={makeSchema('tokenize', ['a', 'b'])}
        onChange={mockOnChange}
      />
    );

    const removeButtons = screen.getAllByText('×');
    fireEvent.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ contains: ['b'] })
    );
  });

  it('disabled=true のとき入力が無効化される', () => {
    render(
      <ParseErrorForm
        schema={makeSchema('tree')}
        onChange={jest.fn()}
        disabled
      />
    );

    expect(screen.getByDisplayValue('tree')).toBeDisabled();
    expect(screen.getByText('+ Add')).toBeDisabled();
  });
});
