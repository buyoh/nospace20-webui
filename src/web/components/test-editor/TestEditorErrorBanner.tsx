import React from 'react';
import { Button } from '../common/Button';
import './styles/TestEditorErrorBanner.scss';

/** TestEditorErrorBanner のプロパティ */
interface TestEditorErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

/** テストエディタの操作（読み込み・保存・作成）の失敗を表示するバナー */
export const TestEditorErrorBanner: React.FC<TestEditorErrorBannerProps> = ({
  message,
  onDismiss,
}) => (
  <div className="test-editor-error-banner" role="alert">
    <span className="test-editor-error-message">{message}</span>
    <Button variant="outline" size="sm" onClick={onDismiss}>
      Dismiss
    </Button>
  </div>
);
