import React, { useEffect } from 'react';
import { CheckResultTypeSelector } from './check-result-editor/CheckResultTypeSelector';
import { CheckResultModeToggle } from './check-result-editor/CheckResultModeToggle';
import { CheckResultJsonView } from './check-result-editor/CheckResultJsonView';
import { CheckResultFormView } from './check-result-editor/CheckResultFormView';
import { useCheckResultEditor } from '../../hooks/useCheckResultEditor';
import './styles/CheckResultEditor.scss';

interface CheckResultEditorProps {
  /** 編集中の JSON 文字列 */
  value: string;
  /** 値が変更されたときのコールバック */
  onChange: (json: string) => void;
  /** 無効化フラグ（保存中など） */
  disabled?: boolean;
  /** JSON テキストが構文として正しいかどうかが変わったときのコールバック（マウント時にも通知する） */
  onValidityChange?: (valid: boolean) => void;
}

/**
 * check.json を構造化 UI フォームまたは JSON テキストで編集するエディタコンポーネント。
 * スキーマに応じた専用フォームを提供し、JSON 構文エラーを防ぐ。
 * value は初回マウント時のみ参照する。別のテストケースを編集するときは、親が key を変えて remount する。
 */
export const CheckResultEditor: React.FC<CheckResultEditorProps> = ({
  value,
  onChange,
  disabled,
  onValidityChange,
}) => {
  const {
    resultType,
    schema,
    editMode,
    jsonText,
    validationErrors,
    isJsonValid,
    handleTypeChange,
    handleFormChange,
    handleJsonChange,
    handleModeChange,
  } = useCheckResultEditor(value, onChange);

  useEffect(() => {
    onValidityChange?.(isJsonValid);
  }, [isJsonValid, onValidityChange]);

  return (
    <div className="check-result-editor">
      <div className="editor-header">
        <CheckResultTypeSelector
          value={resultType}
          onChange={handleTypeChange}
          disabled={disabled || editMode === 'json'}
        />
        <CheckResultModeToggle
          mode={editMode}
          onChange={handleModeChange}
          disabled={disabled || resultType === 'unknown'}
        />
      </div>

      <div className="editor-body">
        {editMode === 'form' && schema ? (
          <CheckResultFormView
            type={resultType}
            schema={schema}
            onChange={handleFormChange}
            disabled={disabled}
          />
        ) : (
          <CheckResultJsonView
            value={jsonText}
            onChange={handleJsonChange}
            errors={validationErrors}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};
