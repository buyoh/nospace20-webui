import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CheckResultEditor } from '../../../../web/components/test-editor/CheckResultEditor';

describe('CheckResultEditor', () => {
  describe('初期化', () => {
    it('success_trace の JSON を渡すとフォームモードで表示される', () => {
      const mockOnChange = jest.fn();
      const json = '{"trace_hit_counts":[1,2,3]}';
      render(<CheckResultEditor value={json} onChange={mockOnChange} />);

      // フォームモードになっていることを確認
      const formRadio = screen.getByDisplayValue('form') as HTMLInputElement;
      expect(formRadio.checked).toBe(true);

      // Trace Hit Counts ラベルが表示される
      expect(screen.getByText('Trace Hit Counts')).toBeInTheDocument();
    });

    it('unknown JSON を渡すと JSON テキストモードで表示される', () => {
      const mockOnChange = jest.fn();
      const json = '{"unknown_field": 123}';
      render(<CheckResultEditor value={json} onChange={mockOnChange} />);

      // JSON テキストモードになっていることを確認
      const jsonRadio = screen.getByDisplayValue('json') as HTMLInputElement;
      expect(jsonRadio.checked).toBe(true);

      // JSON テキストエリアが表示される
      const textarea = screen.getByRole('textbox', { hidden: true });
      expect(textarea).toBeInTheDocument();
    });

    it('無効な JSON を渡すと JSON テキストモードで表示される', () => {
      const mockOnChange = jest.fn();
      render(
        <CheckResultEditor value="invalid json" onChange={mockOnChange} />
      );

      // JSON テキストモードになっていることを確認
      const jsonRadio = screen.getByDisplayValue('json') as HTMLInputElement;
      expect(jsonRadio.checked).toBe(true);
    });

    it('空文字列を渡すと JSON テキストモードで表示される', () => {
      const mockOnChange = jest.fn();
      render(<CheckResultEditor value="" onChange={mockOnChange} />);

      const jsonRadio = screen.getByDisplayValue('json') as HTMLInputElement;
      expect(jsonRadio.checked).toBe(true);
    });
  });

  describe('型選択ドロップダウン', () => {
    it('success_trace の場合は型選択に success_trace が表示される', () => {
      const mockOnChange = jest.fn();
      const json = '{"trace_hit_counts":[1]}';
      render(<CheckResultEditor value={json} onChange={mockOnChange} />);

      const selector = screen.getByRole('combobox') as HTMLSelectElement;
      expect(selector.value).toBe('success_trace');
    });

    it('compile_error の場合は型選択に compile_error が表示される', () => {
      const mockOnChange = jest.fn();
      const json = '{"type":"compile_error","contains":["error"]}';
      render(<CheckResultEditor value={json} onChange={mockOnChange} />);

      const selector = screen.getByRole('combobox') as HTMLSelectElement;
      expect(selector.value).toBe('compile_error');
    });
  });

  describe('フォーム編集', () => {
    it('success_trace フォームで数値を変更すると onChange が呼ばれる', () => {
      const mockOnChange = jest.fn();
      const json = '{"trace_hit_counts":[1]}';
      render(<CheckResultEditor value={json} onChange={mockOnChange} />);

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5' } });

      expect(mockOnChange).toHaveBeenCalled();
      const calledWith = mockOnChange.mock.calls[0][0];
      expect(calledWith).toContain('5');
    });

    it('success_trace フォームで Add ボタンを押すと要素が追加される', () => {
      const mockOnChange = jest.fn();
      const json = '{"trace_hit_counts":[1]}';
      render(<CheckResultEditor value={json} onChange={mockOnChange} />);

      const addButton = screen.getByText('+ Add');
      fireEvent.click(addButton);

      expect(mockOnChange).toHaveBeenCalled();
      const calledWith = JSON.parse(mockOnChange.mock.calls[0][0]);
      expect(calledWith.trace_hit_counts).toHaveLength(2);
    });
  });

  describe('JSON テキスト編集', () => {
    it('JSON テキストモードで値を変更すると onChange が呼ばれる', () => {
      const mockOnChange = jest.fn();
      render(
        <CheckResultEditor value='{"unknown":1}' onChange={mockOnChange} />
      );

      const textarea = screen
        .getAllByRole('textbox')
        .find((el) => el.tagName === 'TEXTAREA') as HTMLTextAreaElement;

      fireEvent.change(textarea, {
        target: { value: '{"trace_hit_counts":[1]}' },
      });

      expect(mockOnChange).toHaveBeenCalledWith('{"trace_hit_counts":[1]}');
    });
  });

  describe('disabled プロパティ', () => {
    it('disabled=true のとき入力が無効化される', () => {
      const mockOnChange = jest.fn();
      const json = '{"trace_hit_counts":[1]}';
      render(
        <CheckResultEditor value={json} onChange={mockOnChange} disabled />
      );

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  describe('value prop 変更時の再描画', () => {
    it('別のテストケースに切り替えると新しい内容に更新される', () => {
      const mockOnChange = jest.fn();
      const { rerender } = render(
        <CheckResultEditor
          value='{"trace_hit_counts":[1,2,3]}'
          onChange={mockOnChange}
        />
      );

      // 最初は success_trace フォームが表示される
      expect(screen.getByText('Trace Hit Counts')).toBeInTheDocument();
      const selector = screen.getByRole('combobox') as HTMLSelectElement;
      expect(selector.value).toBe('success_trace');

      // 別のテストケース（compile_error）に切り替え
      rerender(
        <CheckResultEditor
          value='{"type":"compile_error","contains":["error msg"]}'
          onChange={mockOnChange}
        />
      );

      // compile_error フォームの内容に更新される
      expect(screen.getByRole('combobox')).toHaveValue('compile_error');
      expect(screen.getByDisplayValue('error msg')).toBeInTheDocument();
    });

    it('unknown JSON に切り替えると JSON テキストモードに更新される', () => {
      const mockOnChange = jest.fn();
      const { rerender } = render(
        <CheckResultEditor
          value='{"trace_hit_counts":[1]}'
          onChange={mockOnChange}
        />
      );

      // 最初はフォームモード
      expect(
        (screen.getByDisplayValue('form') as HTMLInputElement).checked
      ).toBe(true);

      // unknown JSON に切り替え
      rerender(
        <CheckResultEditor
          value='{"unknown_field":999}'
          onChange={mockOnChange}
        />
      );

      // JSON テキストモードに切り替わる
      expect(
        (screen.getByDisplayValue('json') as HTMLInputElement).checked
      ).toBe(true);
    });

    it('success_trace の別データに切り替えると count 値が更新される', () => {
      const mockOnChange = jest.fn();
      const { rerender } = render(
        <CheckResultEditor
          value='{"trace_hit_counts":[1]}'
          onChange={mockOnChange}
        />
      );

      let inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs[0].value).toBe('1');

      // 別のカウント値を持つデータに切り替え
      rerender(
        <CheckResultEditor
          value='{"trace_hit_counts":[5,10]}'
          onChange={mockOnChange}
        />
      );

      inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs).toHaveLength(2);
      expect(inputs[0].value).toBe('5');
      expect(inputs[1].value).toBe('10');
    });
  });
});
