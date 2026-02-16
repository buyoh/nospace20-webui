import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { Header } from '../../web/components/layout/Header';
import { flavorAtom, availableFlavorsAtom } from '../../web/stores/flavorAtom';
import { setApplicationFlavor } from '../../web/libs/env';
import '@testing-library/jest-dom';

/**
 * Jotai Store を作成し、Provider でラップしてレンダリングするヘルパー。
 * flavor='websocket' の場合、availableFlavors に 'websocket' が含まれる。
 */
function renderHeader(options?: { flavor?: 'wasm' | 'websocket' }) {
  if (options?.flavor) {
    setApplicationFlavor(options.flavor);
  }
  const store = createStore();
  const result = render(
    <Provider store={store}>
      <Header />
    </Provider>,
  );
  // テスト後にリセット
  if (options?.flavor) {
    setApplicationFlavor('wasm');
  }
  return { ...result, store };
}

describe('Header', () => {
  it('タイトルが表示される', () => {
    renderHeader();
    expect(screen.getByText('nospace Web IDE')).toBeInTheDocument();
  });

  it('wasmのみの場合、バッジでフレーバーが表示される', () => {
    renderHeader();
    const badge = screen.getByTestId('flavor-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('WASM');
  });

  it('wasmのみの場合、セレクタは表示されない', () => {
    renderHeader();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('server有効時、セレクタが表示される', () => {
    renderHeader({ flavor: 'websocket' });
    const select = screen.getByLabelText('Execution flavor');
    expect(select).toBeInTheDocument();
  });

  it('server有効時、フレーバーを切り替えられる', () => {
    const { store } = renderHeader({ flavor: 'websocket' });
    const select = screen.getByLabelText('Execution flavor') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'websocket' } });
    expect(store.get(flavorAtom)).toBe('websocket');
  });
});
