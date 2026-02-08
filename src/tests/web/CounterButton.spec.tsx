import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CounterButton } from '../../web/components/CounterButton';

describe('CounterButton', () => {
  it('ボタンテキストを表示する', () => {
    render(<CounterButton onClick={() => {}}>+1</CounterButton>);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('クリック時にonClickが呼ばれる', () => {
    const handleClick = jest.fn();
    render(<CounterButton onClick={handleClick}>Click</CounterButton>);

    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('primaryバリアントがデフォルト', () => {
    render(<CounterButton onClick={() => {}}>Button</CounterButton>);
    const button = screen.getByText('Button');
    expect(button).toHaveClass('counter-button--primary');
  });

  it('指定したバリアントが適用される', () => {
    render(
      <CounterButton onClick={() => {}} variant="danger">
        Delete
      </CounterButton>
    );
    const button = screen.getByText('Delete');
    expect(button).toHaveClass('counter-button--danger');
  });
});
