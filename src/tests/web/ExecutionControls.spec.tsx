import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionControls } from '../../web/components/execution/ExecutionControls';
import '@testing-library/jest-dom';

describe('ExecutionControls', () => {
  it('Runボタンが表示される', () => {
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

  it('Stopボタンが表示される', () => {
    const mockOnRun = jest.fn();
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={false}
        onRun={mockOnRun}
        onKill={mockOnKill}
      />
    );

    const stopButton = screen.getByText('Stop');
    expect(stopButton).toBeInTheDocument();
  });

  it('実行中でない場合、Runボタンが有効', () => {
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

  it('実行中の場合、Runボタンが無効', () => {
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

  it('Runボタンクリック時にonRunが呼ばれる', () => {
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

  it('Stopボタンクリック時にonKillが呼ばれる', () => {
    const mockOnRun = jest.fn();
    const mockOnKill = jest.fn();
    render(
      <ExecutionControls
        isRunning={true}
        onRun={mockOnRun}
        onKill={mockOnKill}
      />
    );

    const stopButton = screen.getByText('Stop');
    fireEvent.click(stopButton);
    expect(mockOnKill).toHaveBeenCalledTimes(1);
  });
});
