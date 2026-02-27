// Unit test: ExecutionContainer の Run タブ動作を検証する
// - compileOutput がない場合に Run ボタンが disabled になること
// - compileOutput.target が ws でない場合に Run ボタンが disabled になること
// - compileOutput.target が ws の場合に Run ボタンが有効になること
// - Compile タブの CompileOutputPanel に Run ボタンが表示されないこと

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import '@testing-library/jest-dom';
import { flavorAtom } from '../../web/stores/flavorAtom';
import { operationModeAtom } from '../../web/stores/testEditorAtom';
import { compileOutputAtom } from '../../web/stores/compileOutputAtom';
import type { ExecutionBackend } from '../../web/services/ExecutionBackend';
import type { OutputEntry, ExecutionStatus } from '../../interfaces/NospaceTypes';
import type { Flavor } from '../../web/stores/flavorAtom';

// WASM ローダーが必要な重いコンポーネント、外部接続が必要なコンポーネントをモック
jest.mock('../../web/containers/TestEditorContainer', () => ({
  TestEditorContainer: () => <div data-testid="mock-test-editor" />,
}));
jest.mock('../../web/components/execution/ExecutionOptions', () => ({
  ExecutionOptions: () => <div data-testid="mock-execution-options" />,
}));
jest.mock('../../web/components/execution/CompileOptions', () => ({
  CompileOptions: () => <div data-testid="mock-compile-options" />,
}));
jest.mock('../../web/components/execution/OutputPanel', () => ({
  OutputPanel: () => <div data-testid="mock-output-panel" />,
}));
jest.mock('../../web/components/execution/InputPanel', () => ({
  InputPanel: () => <div data-testid="mock-input-panel" />,
}));

// ExecutionContainer はモックセットアップ後に import する
import { ExecutionContainer } from '../../web/containers/ExecutionContainer';

/** テスト用の最小限 Fake ExecutionBackend */
class FakeExecutionBackend implements ExecutionBackend {
  readonly flavor: Flavor = 'wasm';
  isReadyValue = false;

  async init(): Promise<void> {
    this.isReadyValue = true;
  }
  isReady(): boolean { return this.isReadyValue; }
  run(_code: string, _options: any, _stdinData?: string): void {}
  compile(_code: string, _options: any): void {}
  sendStdin(_data: string): void {}
  kill(): void {}
  dispose(): void { this.isReadyValue = false; }
  onOutput(_callback: (entry: OutputEntry) => void): void {}
  onStatusChange(_callback: (status: ExecutionStatus, sessionId: string, exitCode?: number | null) => void): void {}
  onCompileErrors(_callback: (errors: any[]) => void): void {}
}

const fakeBackendFactory = async (_flavor: Flavor): Promise<ExecutionBackend> => {
  return new FakeExecutionBackend();
};

function renderWithStore(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <ExecutionContainer backendFactory={fakeBackendFactory} />
    </Provider>,
  );
}

describe('ExecutionContainer', () => {
  describe('タブ構成', () => {
    it('WASM flavor で Compile / Run タブが表示される', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      const { container } = await act(async () => renderWithStore(store));

      const tabButtons = container.querySelectorAll('.mode-tab');
      const tabLabels = Array.from(tabButtons).map((btn) => btn.textContent);
      expect(tabLabels).toContain('Compile');
      expect(tabLabels).toContain('Run');
    });

    it('WASM flavor で Run(Direct) / Test Editor タブが表示されない', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      const { container } = await act(async () => renderWithStore(store));

      const tabButtons = container.querySelectorAll('.mode-tab');
      const tabLabels = Array.from(tabButtons).map((btn) => btn.textContent);
      expect(tabLabels).not.toContain('Run(Direct)');
      expect(tabLabels).not.toContain('Test Editor');
    });

    it('WebSocket flavor で全タブが表示される', async () => {
      const store = createStore();
      store.set(flavorAtom, 'websocket');
      const { container } = await act(async () => renderWithStore(store));

      const tabButtons = container.querySelectorAll('.mode-tab');
      const tabLabels = Array.from(tabButtons).map((btn) => btn.textContent);
      expect(tabLabels).toContain('Compile');
      expect(tabLabels).toContain('Run');
      expect(tabLabels).toContain('Run(Direct)');
      expect(tabLabels).toContain('Test Editor');
    });
  });

  describe('Run タブ - Run ボタンの disabled 制御', () => {
    it('compileOutput が null の場合、Run ボタンが disabled', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'run');
      store.set(compileOutputAtom, null);
      const { container } = await act(async () => renderWithStore(store));

      const runButton = container.querySelector('.btn-run') as HTMLButtonElement;
      expect(runButton).toBeTruthy();
      expect(runButton).toBeDisabled();
    });

    it('compileOutput.target が "mnemonic" の場合、Run ボタンが disabled', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'run');
      store.set(compileOutputAtom, { output: 'mnemonic output', target: 'mnemonic' });
      const { container } = await act(async () => renderWithStore(store));

      const runButton = container.querySelector('.btn-run') as HTMLButtonElement;
      expect(runButton).toBeTruthy();
      expect(runButton).toBeDisabled();
    });

    it('compileOutput.target が "ws" の場合、Run ボタンが有効', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'run');
      store.set(compileOutputAtom, { output: '   \n   \n', target: 'ws' });
      const { container } = await act(async () => renderWithStore(store));

      const runButton = container.querySelector('.btn-run') as HTMLButtonElement;
      expect(runButton).toBeTruthy();
      expect(runButton).not.toBeDisabled();
    });
  });

  describe('Compile タブ - CompileOutputPanel の Run ボタン', () => {
    it('Compile タブの CompileOutputPanel には Run ボタンが表示されない（ws ターゲットでも）', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'compile');
      // ws ターゲットのコンパイル結果がある場合でも CompileOutputPanel に Run ボタンは不要
      store.set(compileOutputAtom, { output: '   \n', target: 'ws' });
      const { container } = await act(async () => renderWithStore(store));

      // CompileOutputPanel 内の Run ボタン（btn-run-compiled）が存在しないこと
      expect(container.querySelector('.btn-run-compiled')).toBeNull();
    });
  });

  describe('タブクリックによるモード切り替え', () => {
    it('Run タブをクリックすると operationMode が "run" になる', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'compile');
      await act(async () => { renderWithStore(store); });

      const tabButtons = screen.getAllByRole('button');
      const runTabButton = tabButtons.find((btn) => btn.textContent === 'Run' && btn.classList.contains('mode-tab'));
      expect(runTabButton).toBeTruthy();
      await act(async () => { fireEvent.click(runTabButton!); });

      expect(store.get(operationModeAtom)).toBe('run');
    });

    it('Compile タブをクリックすると operationMode が "compile" になる', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'run');
      await act(async () => { renderWithStore(store); });

      const tabButtons = screen.getAllByRole('button');
      const compileTabButton = tabButtons.find((btn) => btn.textContent === 'Compile' && btn.classList.contains('mode-tab'));
      expect(compileTabButton).toBeTruthy();
      await act(async () => { fireEvent.click(compileTabButton!); });

      expect(store.get(operationModeAtom)).toBe('compile');
    });
  });

  describe('WASM flavor のリダイレクト', () => {
    it('WASM flavor で operationMode が "run-direct" の場合、"compile" にリダイレクトされる', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'run-direct');
      await act(async () => { renderWithStore(store); });

      expect(store.get(operationModeAtom)).toBe('compile');
    });

    it('WASM flavor で operationMode が "test-editor" の場合、"compile" にリダイレクトされる', async () => {
      const store = createStore();
      store.set(flavorAtom, 'wasm');
      store.set(operationModeAtom, 'test-editor');
      await act(async () => { renderWithStore(store); });

      expect(store.get(operationModeAtom)).toBe('compile');
    });
  });
});
