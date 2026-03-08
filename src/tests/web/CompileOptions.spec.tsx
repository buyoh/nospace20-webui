import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompileOptions } from '../../web/components/execution/CompileOptions';
import { Provider, createStore } from 'jotai';
import { compileOptionsAtom } from '../../web/stores/optionsAtom';
import '@testing-library/jest-dom';

describe('CompileOptions', () => {
  it('Language セレクターが表示される', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const languageSelect = screen.getByLabelText(
      /Language:/i
    ) as HTMLSelectElement;
    expect(languageSelect).toBeInTheDocument();
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

  it('Language セレクターに指定した全てのオプションが含まれる', () => {
    const testLanguageOptions = [
      { value: 'standard' as const, label: 'Standard' },
      { value: 'min' as const, label: 'Minimal' },
    ];
    render(
      <Provider>
        <CompileOptions languageOptions={testLanguageOptions} />
      </Provider>
    );

    const languageSelect = screen.getByLabelText(
      /Language:/i
    ) as HTMLSelectElement;
    const options = Array.from(languageSelect.options).map((o) => o.value);
    expect(options).toEqual(['standard', 'min']);
  });

  it('Target セレクターに指定した全てのオプションが含まれる', () => {
    const testTargetOptions = [
      { value: 'ws' as const, label: 'WS' },
      { value: 'mnemonic' as const, label: 'Mnemonic' },
      { value: 'ex-ws' as const, label: 'Extended' },
    ];
    render(
      <Provider>
        <CompileOptions targetOptions={testTargetOptions} />
      </Provider>
    );

    const targetSelect = screen.getByLabelText(/Target:/i) as HTMLSelectElement;
    const options = Array.from(targetSelect.options).map((o) => o.value);
    expect(options).toEqual(['ws', 'mnemonic', 'ex-ws']);
  });

  it('Language を変更できる', () => {
    render(
      <Provider>
        <CompileOptions />
      </Provider>
    );

    const languageSelect = screen.getByLabelText(
      /Language:/i
    ) as HTMLSelectElement;
    fireEvent.change(languageSelect, { target: { value: 'standard' } });
    expect(languageSelect.value).toBe('standard');
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

  describe('Std Extensions', () => {
    it('stdExtensions チェックボックスが表示される', () => {
      render(
        <Provider>
          <CompileOptions stdExtensionOptions={['debug', 'alloc']} />
        </Provider>
      );

      expect(screen.getByLabelText('Debug')).toBeInTheDocument();
      expect(screen.getByLabelText('Alloc')).toBeInTheDocument();
    });

    it('チェックボックスを ON にすると atom の stdExtensions に値が追加される', () => {
      const store = createStore();
      render(
        <Provider store={store}>
          <CompileOptions stdExtensionOptions={['debug', 'alloc']} />
        </Provider>
      );

      const debugCheckbox = screen.getByLabelText('Debug') as HTMLInputElement;
      expect(debugCheckbox.checked).toBe(false);

      fireEvent.click(debugCheckbox);
      expect(debugCheckbox.checked).toBe(true);

      const options = store.get(compileOptionsAtom);
      expect(options.stdExtensions).toContain('debug');
    });

    it('チェックボックスを OFF にすると atom の stdExtensions から値が削除される', () => {
      const store = createStore();
      store.set(compileOptionsAtom, {
        language: 'standard',
        target: 'ws',
        stdExtensions: ['debug'],
        optPasses: [],
      });

      render(
        <Provider store={store}>
          <CompileOptions stdExtensionOptions={['debug', 'alloc']} />
        </Provider>
      );

      const debugCheckbox = screen.getByLabelText('Debug') as HTMLInputElement;
      expect(debugCheckbox.checked).toBe(true);

      fireEvent.click(debugCheckbox);
      expect(debugCheckbox.checked).toBe(false);

      const options = store.get(compileOptionsAtom);
      expect(options.stdExtensions).not.toContain('debug');
    });

    it('props で stdExtensionOptions を注入できる', () => {
      render(
        <Provider>
          <CompileOptions stdExtensionOptions={['custom-ext']} />
        </Provider>
      );

      expect(screen.getByLabelText('custom-ext')).toBeInTheDocument();
    });

    it('stdExtensionOptions が空配列の場合はセクションが表示されない', () => {
      render(
        <Provider>
          <CompileOptions stdExtensionOptions={[]} />
        </Provider>
      );

      expect(screen.queryByText('Std Extensions:')).not.toBeInTheDocument();
    });
  });

  describe('Opt Passes', () => {
    it('optPassOptions チェックボックスが表示される', () => {
      render(
        <Provider>
          <CompileOptions optPassOptions={['all', 'condition-opt']} />
        </Provider>
      );

      // 'all' は直接表示される
      expect(screen.getByLabelText('All')).toBeInTheDocument();

      // 'all' 以外は More セクション内に入るため、展開してから確認
      fireEvent.click(screen.getByRole('button', { name: /More/i }));
      expect(screen.getByLabelText('Condition Opt')).toBeInTheDocument();
    });

    it('チェックボックスを ON にすると atom の optPasses に値が追加される', () => {
      const store = createStore();
      store.set(compileOptionsAtom, {
        language: 'standard',
        target: 'ws',
        stdExtensions: [],
        optPasses: [],
      });
      render(
        <Provider store={store}>
          <CompileOptions optPassOptions={['all', 'condition-opt']} />
        </Provider>
      );

      const allCheckbox = screen.getByLabelText('All') as HTMLInputElement;
      expect(allCheckbox.checked).toBe(false);

      fireEvent.click(allCheckbox);
      expect(allCheckbox.checked).toBe(true);

      const options = store.get(compileOptionsAtom);
      expect(options.optPasses).toContain('all');
    });

    it('チェックボックスを OFF にすると atom の optPasses から値が削除される', () => {
      const store = createStore();
      store.set(compileOptionsAtom, {
        language: 'standard',
        target: 'ws',
        stdExtensions: [],
        optPasses: ['all'],
      });

      render(
        <Provider store={store}>
          <CompileOptions optPassOptions={['all', 'condition-opt']} />
        </Provider>
      );

      const allCheckbox = screen.getByLabelText('All') as HTMLInputElement;
      expect(allCheckbox.checked).toBe(true);

      fireEvent.click(allCheckbox);
      expect(allCheckbox.checked).toBe(false);

      const options = store.get(compileOptionsAtom);
      expect(options.optPasses).not.toContain('all');
    });

    it('props で optPassOptions を注入できる', () => {
      render(
        <Provider>
          <CompileOptions optPassOptions={['custom-pass']} />
        </Provider>
      );

      // 'all' 以外の項目は More セクション内に入るため、展開してから確認
      fireEvent.click(screen.getByRole('button', { name: /More/i }));
      expect(screen.getByLabelText('custom-pass')).toBeInTheDocument();
    });

    it('optPassOptions が空配列の場合はセクションが表示されない', () => {
      render(
        <Provider>
          <CompileOptions optPassOptions={[]} />
        </Provider>
      );

      expect(screen.queryByText('Optimization:')).not.toBeInTheDocument();
    });
  });
});
