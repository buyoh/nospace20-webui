import React from 'react';
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
}

/**
 * check.json を構造化 UI フォームまたは JSON テキストで編集するエディタコンポーネント。
 * スキーマに応じた専用フォームを提供し、JSON 構文エラーを防ぐ。
 */
export const CheckResultEditor: React.FC<CheckResultEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const {
    resultType,
    schema,
    editMode,
    jsonText,
    validationErrors,
    handleTypeChange,
    handleFormChange,
    handleJsonChange,
    handleModeChange,
  } = useCheckResultEditor(value, onChange);

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
