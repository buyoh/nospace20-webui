import React from 'react';
import { render, screen } from '@testing-library/react';
import { CounterDisplay } from '../../web/components/CounterDisplay';

describe('CounterDisplay', () => {
  it('カウント値を表示する', () => {
    render(<CounterDisplay count={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('負の値を表示できる', () => {
    render(<CounterDisplay count={-5} />);
    expect(screen.getByText('-5')).toBeInTheDocument();
  });

  it('0を表示できる', () => {
    render(<CounterDisplay count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
