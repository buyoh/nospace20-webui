import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadioGroup } from '../../../web/components/common/RadioGroup';
import '@testing-library/jest-dom';

describe('RadioGroup', () => {
  const options = [
    { value: 'a', label: 'オプション A' },
    { value: 'b', label: 'オプション B' },
    { value: 'c', label: 'オプション C' },
  ] as const;

  it('全選択肢が表示される', () => {
    render(
      <RadioGroup
        name="test-group"
        options={options}
        value="a"
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('オプション A')).toBeInTheDocument();
    expect(screen.getByText('オプション B')).toBeInTheDocument();
    expect(screen.getByText('オプション C')).toBeInTheDocument();
  });

  it('value に対応するラジオが選択状態になる', () => {
    render(
      <RadioGroup
        name="test-group"
        options={options}
        value="b"
        onChange={jest.fn()}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  it('ラジオをクリックすると onChange が呼ばれる', () => {
    const onChange = jest.fn();
    render(
      <RadioGroup
        name="test-group"
        options={options}
        value="a"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText('オプション B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('disabled=true のとき全ラジオが無効になる', () => {
    render(
      <RadioGroup
        name="test-group"
        options={options}
        value="a"
        onChange={jest.fn()}
        disabled
      />
    );
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => expect(radio).toBeDisabled());
  });

  it('common-radio-group クラスが付与される', () => {
    const { container } = render(
      <RadioGroup
        name="test-group"
        options={options}
        value="a"
        onChange={jest.fn()}
      />
    );
    expect(container.firstChild).toHaveClass('common-radio-group');
  });

  it('className がマージされる', () => {
    const { container } = render(
      <RadioGroup
        name="test-group"
        options={options}
        value="a"
        onChange={jest.fn()}
        className="extra"
      />
    );
    expect(container.firstChild).toHaveClass('common-radio-group', 'extra');
  });
});
