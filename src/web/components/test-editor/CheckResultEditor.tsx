import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckResultType,
  CheckResultSchema,
  SuccessTraceSchema,
  SuccessIOSchema,
  CompileErrorSchema,
  ParseErrorSchema,
} from '../../../interfaces/CheckResultSchema';
import {
  parseCheckResult,
  detectCheckResultType,
  serializeCheckResult,
  validateCheckResult,
  createEmptySchema,
} from '../../libs/checkResultParser';
import { SuccessTraceForm } from './check-result-forms/SuccessTraceForm';
import { SuccessIOForm } from './check-result-forms/SuccessIOForm';
import { CompileErrorForm } from './check-result-forms/CompileErrorForm';
import { ParseErrorForm } from './check-result-forms/ParseErrorForm';
import './styles/CheckResultEditor.scss';

// ------------------------------------------------
// サブコンポーネント: 型選択ドロップダウン
// ------------------------------------------------

interface CheckResultTypeSelectorProps {
  value: CheckResultType;
  onChange: (type: CheckResultType) => void;
  disabled?: boolean;
}

const CheckResultTypeSelector: React.FC<CheckResultTypeSelectorProps> = ({
  value,
  onChange,
  disabled,
}) => (
  <select
    className="check-result-type-selector"
    value={value}
    onChange={(e) => onChange(e.target.value as CheckResultType)}
    disabled={disabled}
  >
    <option value="success_trace">Success (Trace)</option>
    <option value="success_io_single">Success (IO - Single)</option>
    <option value="success_io_multi">Success (IO - Multiple)</option>
    <option value="compile_error">Compile Error</option>
    <option value="parse_error">Parse Error</option>
    <option value="unknown">JSON Text (Manual)</option>
  </select>
);

// ------------------------------------------------
// サブコンポーネント: Form/JSON Text モード切り替え
// ------------------------------------------------

interface CheckResultModeToggleProps {
  mode: 'form' | 'json';
  onChange: (mode: 'form' | 'json') => void;
  disabled?: boolean;
}

const CheckResultModeToggle: React.FC<CheckResultModeToggleProps> = ({
  mode,
  onChange,
  disabled,
}) => (
  <div className="check-result-mode-toggle">
    <label>
      <input
        type="radio"
        name="edit-mode"
        value="form"
        checked={mode === 'form'}
        onChange={() => onChange('form')}
        disabled={disabled}
      />
      Form
    </label>
    <label>
      <input
        type="radio"
        name="edit-mode"
        value="json"
        checked={mode === 'json'}
        onChange={() => onChange('json')}
        disabled={disabled}
      />
      JSON Text
    </label>
  </div>
);

// ------------------------------------------------
// サブコンポーネント: JSON テキストエディタビュー
// ------------------------------------------------

interface CheckResultJsonViewProps {
  value: string;
  onChange: (json: string) => void;
  errors?: string[];
  disabled?: boolean;
}

const CheckResultJsonView: React.FC<CheckResultJsonViewProps> = ({
  value,
  onChange,
  errors,
  disabled,
}) => (
  <div className="check-result-json-view">
    <textarea
      className="json-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
    {errors && errors.length > 0 && (
      <div className="validation-errors">
        {errors.map((error, index) => (
          <div key={index} className="error-message">
            {error}
          </div>
        ))}
      </div>
    )}
  </div>
);

// ------------------------------------------------
// サブコンポーネント: フォーム分岐コンポーネント
// ------------------------------------------------

interface CheckResultFormViewProps {
  type: CheckResultType;
  schema: CheckResultSchema;
  onChange: (schema: CheckResultSchema) => void;
  disabled?: boolean;
}

const CheckResultFormView: React.FC<CheckResultFormViewProps> = ({
  type,
  schema,
  onChange,
  disabled,
}) => {
  switch (type) {
    case 'success_trace':
      return (
        <SuccessTraceForm
          schema={schema as SuccessTraceSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'success_io_single':
    case 'success_io_multi':
      return (
        <SuccessIOForm
          schema={schema as SuccessIOSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'compile_error':
      return (
        <CompileErrorForm
          schema={schema as CompileErrorSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'parse_error':
      return (
        <ParseErrorForm
          schema={schema as ParseErrorSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    default:
      return <div>Unsupported schema type</div>;
  }
};

// ------------------------------------------------
// メインコンポーネント: CheckResultEditor
// ------------------------------------------------

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
  const [resultType, setResultType] = useState<CheckResultType>('unknown');
  const [schema, setSchema] = useState<CheckResultSchema | null>(null);
  const [editMode, setEditMode] = useState<'form' | 'json'>('json');
  const [jsonText, setJsonText] = useState<string>(value);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 初期化: props.value をパースして state を設定
  useEffect(() => {
    const parsed = parseCheckResult(value);
    if (parsed) {
      setResultType(parsed.resultType);
      setSchema(parsed.schema);
      setJsonText(value);
      // unknown でなければフォームモードに切り替え
      if (parsed.resultType !== 'unknown') {
        setEditMode('form');
      } else {
        setEditMode('json');
      }
    } else {
      // JSON 構文エラー
      setResultType('unknown');
      setSchema(null);
      setEditMode('json');
      setJsonText(value);
    }
    // 初期化時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 型変更ハンドラー
  const handleTypeChange = useCallback(
    (newType: CheckResultType) => {
      if (newType === 'unknown') {
        setResultType('unknown');
        setEditMode('json');
        return;
      }

      // データがある場合は確認
      if (schema && resultType !== 'unknown') {
        if (
          !window.confirm(
            'Changing the type will reset the current data. Continue?',
          )
        ) {
          return;
        }
      }

      const newSchema = createEmptySchema(newType);
      setResultType(newType);
      setSchema(newSchema);
      if (newSchema) {
        const newJson = serializeCheckResult(newSchema);
        setJsonText(newJson);
        const errors = validateCheckResult(newSchema);
        setValidationErrors(errors);
        onChange(newJson);
      }
      setEditMode('form');
    },
    [schema, resultType, onChange],
  );

  // フォーム編集ハンドラー
  const handleFormChange = useCallback(
    (newSchema: CheckResultSchema) => {
      setSchema(newSchema);
      const newType = detectCheckResultType(newSchema);
      setResultType(newType);
      const errors = validateCheckResult(newSchema);
      setValidationErrors(errors);
      const newJson = serializeCheckResult(newSchema);
      setJsonText(newJson);
      onChange(newJson);
    },
    [onChange],
  );

  // JSON テキスト編集ハンドラー
  const handleJsonChange = useCallback(
    (newJson: string) => {
      setJsonText(newJson);
      const parsed = parseCheckResult(newJson);
      if (parsed) {
        setSchema(parsed.schema);
        setResultType(parsed.resultType);
        if (parsed.schema) {
          const errors = validateCheckResult(parsed.schema);
          setValidationErrors(errors);
        } else {
          setValidationErrors([]);
        }
        onChange(newJson);
      } else {
        setValidationErrors(['Invalid JSON syntax']);
      }
    },
    [onChange],
  );

  // モード切り替えハンドラー
  const handleModeChange = useCallback(
    (newMode: 'form' | 'json') => {
      setEditMode(newMode);
    },
    [],
  );

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
