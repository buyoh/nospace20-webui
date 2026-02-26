import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from '../../../web/components/common/Select';
import '@testing-library/jest-dom';

describe('Select', () => {
  it('common-select クラスが付与される', () => {
    render(
      <Select>
        <option value="a">A</option>
      </Select>
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('common-select');
  });

  it('className がマージされる', () => {
    render(
      <Select className="my-select">
        <option value="a">A</option>
      </Select>
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('common-select', 'my-select');
  });

  it('children として option が表示される', () => {
    render(
      <Select>
        <option value="x">X オプション</option>
        <option value="y">Y オプション</option>
      </Select>
    );
    expect(screen.getByText('X オプション')).toBeInTheDocument();
    expect(screen.getByText('Y オプション')).toBeInTheDocument();
  });

  it('disabled が反映される', () => {
    render(
      <Select disabled>
        <option value="a">A</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('onChange が呼ばれる', () => {
    const onChange = jest.fn();
    render(
      <Select onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
