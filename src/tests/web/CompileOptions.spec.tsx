import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompileOptions } from '../../web/components/execution/CompileOptions';
import { Provider } from 'jotai';
import '@testing-library/jest-dom';

describe('CompileOptions', () => {
  it('Language セレクターが表示される', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const languageSelect = screen.getByLabelText(/Language:/i) as HTMLSelectElement;
    expect(languageSelect).toBeInTheDocument();
    expect(languageSelect.value).toBe('standard');
  });

  it('Target セレクターが表示される', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const targetSelect = screen.getByLabelText(/Target:/i) as HTMLSelectElement;
    expect(targetSelect).toBeInTheDocument();
    expect(targetSelect.value).toBe('ws');
  });

  it('Language セレクターに全てのオプションが含まれる', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const languageSelect = screen.getByLabelText(/Language:/i) as HTMLSelectElement;
    const options = Array.from(languageSelect.options).map(o => o.value);
    expect(options).toEqual(['standard', 'min', 'ws']);
  });

  it('Target セレクターに全てのオプションが含まれる', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const targetSelect = screen.getByLabelText(/Target:/i) as HTMLSelectElement;
    const options = Array.from(targetSelect.options).map(o => o.value);
    expect(options).toEqual(['ws', 'mnemonic', 'ex-ws', 'json']);
  });

  it('Language を変更できる', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const languageSelect = screen.getByLabelText(/Language:/i) as HTMLSelectElement;
    fireEvent.change(languageSelect, { target: { value: 'min' } });
    expect(languageSelect.value).toBe('min');
  });

  it('Target を変更できる', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const targetSelect = screen.getByLabelText(/Target:/i) as HTMLSelectElement;
    fireEvent.change(targetSelect, { target: { value: 'mnemonic' } });
    expect(targetSelect.value).toBe('mnemonic');
  });
});
