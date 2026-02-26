import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from '../../../web/components/common/Checkbox';
import '@testing-library/jest-dom';

describe('Checkbox', () => {
  it('label テキストが表示される', () => {
    render(<Checkbox label="デバッグトレース" />);
    expect(screen.getByText('デバッグトレース')).toBeInTheDocument();
  });

  it('type="checkbox" の input が存在する', () => {
    render(<Checkbox label="テスト" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('common-checkbox クラスが付与される', () => {
    const { container } = render(<Checkbox label="テスト" />);
    expect(container.firstChild).toHaveClass('common-checkbox');
  });

  it('className がマージされる', () => {
    const { container } = render(<Checkbox label="テスト" className="extra" />);
    expect(container.firstChild).toHaveClass('common-checkbox', 'extra');
  });

  it('checked が反映される', () => {
    render(<Checkbox label="テスト" checked onChange={jest.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('onChange コールバックが呼ばれる', () => {
    const onChange = jest.fn();
    render(<Checkbox label="テスト" onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled が反映される', () => {
    render(<Checkbox label="テスト" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
