import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '../../web/components/common/CollapsibleSection';
import '@testing-library/jest-dom';

describe('CollapsibleSection', () => {
  describe('非制御モード（collapsed / onToggleCollapse 未指定）', () => {
    it('初期状態でコンテンツが表示される', () => {
      render(
        <CollapsibleSection title="テストタイトル">
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(screen.getByText('本体コンテンツ')).toBeInTheDocument();
    });

    it('ヘッダーボタンをクリックすると折りたたまれる', () => {
      render(
        <CollapsibleSection title="テストタイトル">
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      const toggleButton = screen.getByRole('button', {
        name: /テストタイトル/,
      });
      fireEvent.click(toggleButton);
      expect(screen.queryByText('本体コンテンツ')).not.toBeInTheDocument();
    });

    it('折りたたんだ後に再クリックで展開される', () => {
      render(
        <CollapsibleSection title="テストタイトル">
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      const toggleButton = screen.getByRole('button', {
        name: /テストタイトル/,
      });
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      expect(screen.getByText('本体コンテンツ')).toBeInTheDocument();
    });

    it('defaultCollapsed=true で初期折りたたみ状態になる', () => {
      render(
        <CollapsibleSection title="テストタイトル" defaultCollapsed>
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(screen.queryByText('本体コンテンツ')).not.toBeInTheDocument();
    });
  });

  describe('制御モード（collapsed / onToggleCollapse 指定）', () => {
    it('collapsed=false のとき本体が表示される', () => {
      render(
        <CollapsibleSection
          title="テストタイトル"
          collapsed={false}
          onToggleCollapse={jest.fn()}
        >
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(screen.getByText('本体コンテンツ')).toBeInTheDocument();
    });

    it('collapsed=true のとき本体が非表示になる', () => {
      render(
        <CollapsibleSection
          title="テストタイトル"
          collapsed={true}
          onToggleCollapse={jest.fn()}
        >
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(screen.queryByText('本体コンテンツ')).not.toBeInTheDocument();
    });

    it('ボタンクリック時に onToggleCollapse が呼ばれる', () => {
      const onToggle = jest.fn();
      render(
        <CollapsibleSection
          title="テストタイトル"
          collapsed={false}
          onToggleCollapse={onToggle}
        >
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      const toggleButton = screen.getByRole('button', {
        name: /テストタイトル/,
      });
      fireEvent.click(toggleButton);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('headerActions', () => {
    it('headerActions に渡した要素が表示される', () => {
      render(
        <CollapsibleSection
          title="テストタイトル"
          headerActions={<button>アクション</button>}
        >
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(screen.getByText('アクション')).toBeInTheDocument();
    });
  });

  describe('aria-expanded', () => {
    it('展開状態で aria-expanded=true', () => {
      render(
        <CollapsibleSection title="テストタイトル">
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      const toggleButton = screen.getByRole('button', {
        name: /テストタイトル/,
      });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('折りたたみ状態で aria-expanded=false', () => {
      render(
        <CollapsibleSection title="テストタイトル" defaultCollapsed>
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      const toggleButton = screen.getByRole('button', {
        name: /テストタイトル/,
      });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('className', () => {
    it('className がルート要素に付与される', () => {
      const { container } = render(
        <CollapsibleSection title="テストタイトル" className="my-custom-class">
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(container.firstChild).toHaveClass('my-custom-class');
    });

    it('collapsible-section クラスが付与される', () => {
      const { container } = render(
        <CollapsibleSection title="テストタイトル">
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(container.firstChild).toHaveClass('collapsible-section');
    });

    it('折りたたみ時に collapsed クラスが付与される', () => {
      const { container } = render(
        <CollapsibleSection title="テストタイトル" defaultCollapsed>
          <div>本体コンテンツ</div>
        </CollapsibleSection>
      );
      expect(container.firstChild).toHaveClass('collapsed');
    });
  });
});
