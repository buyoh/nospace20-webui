import { useEffect, useState, useCallback } from 'react';
import type { CheckResultType, CheckResultSchema } from '../../interfaces/CheckResultSchema';
import {
  parseCheckResult,
  detectCheckResultType,
  serializeCheckResult,
  validateCheckResult,
  createEmptySchema,
} from '../libs/checkResultParser';

/** useCheckResultEditor フックの返り値 */
export interface UseCheckResultEditorResult {
  /** 現在選択されているスキーマ型 */
  resultType: CheckResultType;
  /** 現在のスキーマオブジェクト（JSON テキストモード時は null の場合がある） */
  schema: CheckResultSchema | null;
  /** 編集モード（フォームまたは JSON テキスト） */
  editMode: 'form' | 'json';
  /** JSON テキストエディタに表示する文字列 */
  jsonText: string;
  /** スキーマバリデーションエラー一覧 */
  validationErrors: string[];
  /** スキーマ型変更ハンドラー */
  handleTypeChange: (newType: CheckResultType) => void;
  /** フォーム編集ハンドラー */
  handleFormChange: (newSchema: CheckResultSchema) => void;
  /** JSON テキスト編集ハンドラー */
  handleJsonChange: (newJson: string) => void;
  /** 編集モード切り替えハンドラー */
  handleModeChange: (newMode: 'form' | 'json') => void;
}

/**
 * CheckResultEditor の状態管理ロジックを担うカスタムフック。
 * JSON パース / バリデーション / スキーマ型判定 / モード切り替えを統括する。
 *
 * @param value - 外部から渡される check.json の文字列
 * @param onChange - 値が更新されたときに呼び出すコールバック
 */
export function useCheckResultEditor(
  value: string,
  onChange: (json: string) => void,
): UseCheckResultEditorResult {
  const [resultType, setResultType] = useState<CheckResultType>('unknown');
  const [schema, setSchema] = useState<CheckResultSchema | null>(null);
  const [editMode, setEditMode] = useState<'form' | 'json'>('json');
  const [jsonText, setJsonText] = useState<string>(value);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // value が変わるたびに state を再初期化する。
  // テストケースを切り替えたとき（selectedPath 変更→ loadTestCase→ editingTestCaseAtom 更新）
  // に value prop が新しい内容になるため、表示を正しく追従させる必要がある。
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
  }, [value]);

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
  const handleModeChange = useCallback((newMode: 'form' | 'json') => {
    setEditMode(newMode);
  }, []);

  return {
    resultType,
    schema,
    editMode,
    jsonText,
    validationErrors,
    handleTypeChange,
    handleFormChange,
    handleJsonChange,
    handleModeChange,
  };
}
