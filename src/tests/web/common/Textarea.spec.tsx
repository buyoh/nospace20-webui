import React from 'react';
import { render, screen } from '@testing-library/react';
import { Textarea } from '../../../web/components/common/Textarea';
import '@testing-library/jest-dom';

describe('Textarea', () => {
  it('common-textarea クラスが付与される', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toHaveClass('common-textarea');
  });

  it('className がマージされる', () => {
    render(<Textarea className="extra" />);
    expect(screen.getByRole('textbox')).toHaveClass('common-textarea', 'extra');
  });

  it('disabled が反映される', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('value が反映される', () => {
    render(<Textarea value="テキスト" readOnly />);
    expect(screen.getByRole('textbox')).toHaveValue('テキスト');
  });
});
