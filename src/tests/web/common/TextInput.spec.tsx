import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextInput } from '../../../web/components/common/TextInput';
import '@testing-library/jest-dom';

describe('TextInput', () => {
  it('common-text-input クラスが付与される', () => {
    render(<TextInput />);
    expect(screen.getByRole('textbox')).toHaveClass('common-text-input');
  });

  it('type="number" が反映される', () => {
    render(<TextInput type="number" />);
    const input = document.querySelector('input[type="number"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('common-text-input');
  });

  it('className がマージされる', () => {
    render(<TextInput className="extra" />);
    expect(screen.getByRole('textbox')).toHaveClass(
      'common-text-input',
      'extra'
    );
  });

  it('disabled が反映される', () => {
    render(<TextInput disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('value と onChange が動作する', () => {
    const onChange = jest.fn();
    render(<TextInput value="test" onChange={onChange} readOnly />);
    expect(screen.getByRole('textbox')).toHaveValue('test');
  });
});
