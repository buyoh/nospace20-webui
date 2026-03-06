import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../../web/components/common/Button';
import '@testing-library/jest-dom';

describe('Button', () => {
  it('children が表示される', () => {
    render(<Button>クリック</Button>);
    expect(screen.getByText('クリック')).toBeInTheDocument();
  });

  it('デフォルトで btn-primary btn-md クラスが付与される', () => {
    render(<Button>ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('btn', 'btn-primary', 'btn-md');
  });

  it('variant="danger" でクラスが付与される', () => {
    render(<Button variant="danger">停止</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('btn-danger');
  });

  it('variant="accent" でクラスが付与される', () => {
    render(<Button variant="accent">コンパイル</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('btn-accent');
  });

  it('variant="secondary" でクラスが付与される', () => {
    render(<Button variant="secondary">キャンセル</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('btn-secondary');
  });

  it('variant="outline" でクラスが付与される', () => {
    render(<Button variant="outline">クリア</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('btn-outline');
  });

  it('size="sm" でクラスが付与される', () => {
    render(<Button size="sm">小ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('btn-sm');
  });

  it('className がマージされる', () => {
    render(<Button className="extra-class">ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('extra-class', 'btn');
  });

  it('disabled 時にクリックが無効になる', () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        ボタン
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('onClick コールバックが呼ばれる', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>ボタン</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
