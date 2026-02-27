import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'jotai';
import { CompileOutputPanel } from '../../web/components/execution/CompileOutputPanel';
import '@testing-library/jest-dom';

describe('CompileOutputPanel', () => {
  const defaultProps = {
    compileOutput: null,
    onRunCompiled: jest.fn(),
    isRunning: false,
    collapsed: false,
    onToggleCollapse: jest.fn(),
  };

  it('ヘッダーに "Compiled Output" が表示される', () => {
    render(<CompileOutputPanel {...defaultProps} />);
    expect(screen.getByText('Compiled Output')).toBeInTheDocument();
  });

  it('コンパイル出力がない場合、空メッセージが表示される', () => {
    render(<CompileOutputPanel {...defaultProps} />);
    expect(screen.getByText('No compiled output yet')).toBeInTheDocument();
  });

  it('コンパイル出力がある場合、内容が表示される', () => {
    render(
      <CompileOutputPanel
        {...defaultProps}
        compileOutput={{ output: 'compiled code here', target: 'mnemonic' }}
      />
    );
    expect(screen.getByText('compiled code here')).toBeInTheDocument();
  });

  it('折りたたみ時にコンテンツが非表示になる', () => {
    render(
      <CompileOutputPanel
        {...defaultProps}
        collapsed={true}
        compileOutput={{ output: 'some text', target: 'ws' }}
      />
    );
    expect(screen.queryByText('some text')).not.toBeInTheDocument();
  });

  it('折りたたみトグルボタンをクリックすると onToggleCollapse が呼ばれる', () => {
    const onToggle = jest.fn();
    render(
      <CompileOutputPanel
        {...defaultProps}
        onToggleCollapse={onToggle}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Compiled Output/ });
    fireEvent.click(toggleButton);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('折りたたみ中のトグルボタンに aria-expanded="false" が設定される', () => {
    render(
      <CompileOutputPanel
        {...defaultProps}
        collapsed={true}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Compiled Output/ });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });

  describe('Run ボタン', () => {
    it('ターゲットが ws の場合、Run ボタンが表示される', () => {
      render(
        <CompileOutputPanel
          {...defaultProps}
          compileOutput={{ output: 'ws code', target: 'ws' }}
        />
      );
      expect(screen.getByText('Run')).toBeInTheDocument();
    });

    it('ターゲットが ws 以外の場合、Run ボタンが表示されない', () => {
      render(
        <CompileOutputPanel
          {...defaultProps}
          compileOutput={{ output: 'mnemonic output', target: 'mnemonic' }}
        />
      );
      expect(screen.queryByText('Run')).not.toBeInTheDocument();
    });

    it('コンパイル出力がない場合、Run ボタンが表示されない', () => {
      render(<CompileOutputPanel {...defaultProps} />);
      expect(screen.queryByText('Run')).not.toBeInTheDocument();
    });

    it('Run ボタンクリック時に onRunCompiled が呼ばれる', () => {
      const onRun = jest.fn();
      render(
        <CompileOutputPanel
          {...defaultProps}
          compileOutput={{ output: 'ws code', target: 'ws' }}
          onRunCompiled={onRun}
        />
      );

      const runButton = screen.getByText('Run');
      fireEvent.click(runButton);
      expect(onRun).toHaveBeenCalledTimes(1);
    });

    it('実行中の場合、Run ボタンが無効', () => {
      render(
        <CompileOutputPanel
          {...defaultProps}
          compileOutput={{ output: 'ws code', target: 'ws' }}
          isRunning={true}
        />
      );

      const runButton = screen.getByText('Run');
      expect(runButton).toBeDisabled();
    });

    it('折りたたみ中でも Run ボタンが表示される（ws ターゲット時）', () => {
      render(
        <CompileOutputPanel
          {...defaultProps}
          compileOutput={{ output: 'ws code', target: 'ws' }}
          collapsed={true}
        />
      );

      expect(screen.getByText('Run')).toBeInTheDocument();
    });

    it('onRunCompiled 未指定時は ws ターゲットでも Run ボタンが表示されない', () => {
      // onRunCompiled を省略（Compile タブでは Run ボタン不要）
      const { onRunCompiled: _, ...propsWithoutRunCompiled } = defaultProps;
      render(
        <CompileOutputPanel
          {...propsWithoutRunCompiled}
          compileOutput={{ output: 'ws code', target: 'ws' }}
        />
      );

      expect(screen.queryByText('Run')).not.toBeInTheDocument();
    });
  });

  describe('表示モード切り替え', () => {
    it('ws ターゲットの場合、表示モードトグルが表示される', () => {
      render(
        <Provider>
          <CompileOutputPanel
            {...defaultProps}
            compileOutput={{ output: ' \t\n', target: 'ws' }}
          />
        </Provider>
      );
      expect(screen.getByText('Raw')).toBeInTheDocument();
      expect(screen.getByText('SP TB LF')).toBeInTheDocument();
    });

    it('ex-ws ターゲットの場合、表示モードトグルが表示される', () => {
      render(
        <Provider>
          <CompileOutputPanel
            {...defaultProps}
            compileOutput={{ output: ' \t\n', target: 'ex-ws' }}
          />
        </Provider>
      );
      expect(screen.getByText('Raw')).toBeInTheDocument();
      expect(screen.getByText('SP TB LF')).toBeInTheDocument();
    });

    it('mnemonic ターゲットの場合、表示モードトグルが表示されない', () => {
      render(
        <Provider>
          <CompileOutputPanel
            {...defaultProps}
            compileOutput={{ output: 'push 1', target: 'mnemonic' }}
          />
        </Provider>
      );
      expect(screen.queryByText('Raw')).not.toBeInTheDocument();
      expect(screen.queryByText('SP TB LF')).not.toBeInTheDocument();
    });

    it('ws ターゲットのデフォルトは visible モード（SP/TB/LF 表示）', () => {
      render(
        <Provider>
          <CompileOutputPanel
            {...defaultProps}
            compileOutput={{ output: ' \t\n', target: 'ws' }}
          />
        </Provider>
      );
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toContain('SP');
      expect(textarea.value).toContain('TB');
      expect(textarea.value).toContain('LF');
    });

    it('Raw ボタンをクリックすると生テキストが表示される', () => {
      render(
        <Provider>
          <CompileOutputPanel
            {...defaultProps}
            compileOutput={{ output: ' \t\n', target: 'ws' }}
          />
        </Provider>
      );
      fireEvent.click(screen.getByText('Raw'));
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(' \t\n');
    });
  });

});
