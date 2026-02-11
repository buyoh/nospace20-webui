import React from 'react';
import { render, screen } from '@testing-library/react';
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
    textarea.value = newValue;
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    expect(mockOnChange).toHaveBeenCalled();
  });
});
