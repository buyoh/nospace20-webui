import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionControls } from '../../web/components/execution/ExecutionControls';
import '@testing-library/jest-dom';

describe('ExecutionControls', () => {
  it('onRun 指定時に Run ボタンが表示される', () => {
    const mockOnRun = jest.fn();
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onRun={mockOnRun}
        onKill={mockOnKill}
      />
    );

    const runButton = screen.getByText('Run');
    expect(runButton).toBeInTheDocument();
  });

  it('onRun 未指定時に Run ボタンが表示されない', () => {
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
      />
    );

    expect(screen.queryByText('Run')).not.toBeInTheDocument();
  });

  it('Stop ボタンが表示される', () => {
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
      />
    );

    const stopButton = screen.getByText('Stop');
    expect(stopButton).toBeInTheDocument();
  });

  it('実行中でない場合、Run ボタンが有効', () => {
    const mockOnRun = jest.fn();
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onRun={mockOnRun}
        onKill={mockOnKill}
      />
    );

    const runButton = screen.getByText('Run');
    expect(runButton).not.toBeDisabled();
  });

  it('実行中の場合、Run ボタンが無効', () => {
    const mockOnRun = jest.fn();
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={true}
        onRun={mockOnRun}
        onKill={mockOnKill}
      />
    );

    const runButton = screen.getByText('Run');
    expect(runButton).toBeDisabled();
  });

  it('Run ボタンクリック時に onRun が呼ばれる', () => {
    const mockOnRun = jest.fn();
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onRun={mockOnRun}
        onKill={mockOnKill}
      />
    );

    const runButton = screen.getByText('Run');
    fireEvent.click(runButton);
    expect(mockOnRun).toHaveBeenCalledTimes(1);
  });

  it('Stop ボタンクリック時に onKill が呼ばれる', () => {
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={true}
        onKill={mockOnKill}
      />
    );

    const stopButton = screen.getByText('Stop');
    fireEvent.click(stopButton);
    expect(mockOnKill).toHaveBeenCalledTimes(1);
  });

  it('onCompile 未指定時に Compile ボタンが表示されない', () => {
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
        onRun={jest.fn()}
      />
    );

    expect(screen.queryByText('Compile')).not.toBeInTheDocument();
  });

  it('onCompile 指定時に Compile ボタンが表示される', () => {
    const mockOnKill = jest.fn();
    const mockOnCompile = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
        onCompile={mockOnCompile}
      />
    );

    const compileButton = screen.getByText('Compile');
    expect(compileButton).toBeInTheDocument();
  });

  it('実行中でない場合、Compile ボタンが有効', () => {
    const mockOnKill = jest.fn();
    const mockOnCompile = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
        onCompile={mockOnCompile}
      />
    );

    const compileButton = screen.getByText('Compile');
    expect(compileButton).not.toBeDisabled();
  });

  it('実行中の場合、Compile ボタンが無効', () => {
    const mockOnKill = jest.fn();
    const mockOnCompile = jest.fn();
    render(
      <ExecutionControls
        isRunning={true}
        onKill={mockOnKill}
        onCompile={mockOnCompile}
      />
    );

    const compileButton = screen.getByText('Compile');
    expect(compileButton).toBeDisabled();
  });

  it('Compile ボタンクリック時に onCompile が呼ばれる', () => {
    const mockOnKill = jest.fn();
    const mockOnCompile = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
        onCompile={mockOnCompile}
      />
    );

    const compileButton = screen.getByText('Compile');
    fireEvent.click(compileButton);
    expect(mockOnCompile).toHaveBeenCalledTimes(1);
  });

  it('Compile mode（onRun 無し、onCompile あり）のレイアウト', () => {
    const mockOnKill = jest.fn();
    const mockOnCompile = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onKill={mockOnKill}
        onCompile={mockOnCompile}
      />
    );

    expect(screen.getByText('Compile')).toBeInTheDocument();
    expect(screen.queryByText('Run')).not.toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });
});
