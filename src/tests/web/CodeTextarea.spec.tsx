import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CodeTextarea } from '../../web/components/editor/CodeTextarea';
import '@testing-library/jest-dom';

describe('CodeTextarea', () => {
  it('レンダリングされる', () => {
    const mockOnChange = jest.fn();
    render(<CodeTextarea value="" onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      /Write your nospace code here.../i
    );
    expect(textarea).toBeInTheDocument();
  });

  it('valueを表示する', () => {
    const mockOnChange = jest.fn();
    const testValue = 'print "Hello"';
    render(<CodeTextarea value={testValue} onChange={mockOnChange} />);

    const textarea = screen.getByDisplayValue(testValue);
    expect(textarea).toBeInTheDocument();
  });

  it('変更時にonChangeが呼ばれる', () => {
    const mockOnChange = jest.fn();
    render(<CodeTextarea value="" onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      /Write your nospace code here.../i
    ) as HTMLTextAreaElement;

    // ユーザーがテキストを入力する動作をシミュレート
    const newValue = 'test';
    fireEvent.change(textarea, { target: { value: newValue } });

    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith(newValue);
  });

  it('Tabキー押下でスペース2つが挿入される', () => {
    const mockOnChange = jest.fn();
    const initialValue = 'hello';
    render(<CodeTextarea value={initialValue} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      /Write your nospace code here.../i
    ) as HTMLTextAreaElement;

    // カーソル位置を設定（文字列の末尾）
    textarea.setSelectionRange(5, 5);

    // Tabキーを押下
    fireEvent.keyDown(textarea, { key: 'Tab', code: 'Tab' });

    // onChangeが2つのスペースを挿入した新しい値で呼ばれることを確認
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith('hello  ');
  });

  it('Tabキー押下でテキスト選択範囲が置き換えられる', () => {
    const mockOnChange = jest.fn();
    const initialValue = 'hello world';
    render(<CodeTextarea value={initialValue} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      /Write your nospace code here.../i
    ) as HTMLTextAreaElement;

    // "world" を選択（6文字目から11文字目）
    textarea.setSelectionRange(6, 11);

    // Tabキーを押下
    fireEvent.keyDown(textarea, { key: 'Tab', code: 'Tab' });

    // 選択範囲が2つのスペースに置き換えられることを確認
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith('hello   ');
  });
});
