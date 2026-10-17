import { useState, useCallback } from 'react';
import type {
  CheckResultType,
  CheckResultSchema,
} from '../../interfaces/CheckResultSchema';
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
  /**
   * 現在の JSON テキストが構文として正しいか（空は「check なし」として正しい扱い）。
   * false の間は onChange が呼ばれず外部の値は更新されないため、保存を許可してはならない。
   */
  isJsonValid: boolean;
  /** スキーマ型変更ハンドラー */
  handleTypeChange: (newType: CheckResultType) => void;
  /** フォーム編集ハンドラー */
  handleFormChange: (newSchema: CheckResultSchema) => void;
  /** JSON テキスト編集ハンドラー */
  handleJsonChange: (newJson: string) => void;
  /** 編集モード切り替えハンドラー */
  handleModeChange: (newMode: 'form' | 'json') => void;
}

/** エディタの初期状態 */
interface InitialEditorState {
  resultType: CheckResultType;
  schema: CheckResultSchema | null;
  editMode: 'form' | 'json';
  validationErrors: string[];
  isJsonValid: boolean;
}

/** 外部から渡された値から、エディタの初期状態を導出する */
function deriveInitialState(value: string): InitialEditorState {
  // 空（check.json なし）は有効。JSON 構文エラー扱いにすると、check なしのテストを開いた
  // 瞬間にエラーが出て保存できなくなる
  if (value.trim() === '') {
    return {
      resultType: 'unknown',
      schema: null,
      editMode: 'json',
      validationErrors: [],
      isJsonValid: true,
    };
  }
  const parsed = parseCheckResult(value);
  if (!parsed) {
    return {
      resultType: 'unknown',
      schema: null,
      editMode: 'json',
      validationErrors: ['Invalid JSON syntax'],
      isJsonValid: false,
    };
  }
  return {
    resultType: parsed.resultType,
    schema: parsed.schema,
    // unknown でなければフォームモードで開く
    editMode: parsed.resultType !== 'unknown' ? 'form' : 'json',
    validationErrors: parsed.schema ? validateCheckResult(parsed.schema) : [],
    isJsonValid: true,
  };
}

/**
 * CheckResultEditor の状態管理ロジックを担うカスタムフック。
 * JSON パース / バリデーション / スキーマ型判定 / モード切り替えを統括する。
 *
 * BUG FIX: 以前は value が変わるたびに effect で state を再初期化していた。ユーザーが
 * JSON モードで編集して有効な JSON になると onChange → value 変化 → フォームモードへ強制遷移し、
 * タイピング中にモードが戻ってしまった。また effect が validationErrors を再計算しなかった。
 * 解決策として、初期状態は初回マウント時のみ value から導出し、value の変化には追従しない。
 * テストケースを切り替えたときは、親が `key` を変えて remount することで初期化する。
 *
 * @param value - 初回マウント時の check.json の文字列
 * @param onChange - 値が更新されたときに呼び出すコールバック
 */
export function useCheckResultEditor(
  value: string,
  onChange: (json: string) => void
): UseCheckResultEditorResult {
  const [initial] = useState(() => deriveInitialState(value));
  const [resultType, setResultType] = useState<CheckResultType>(
    initial.resultType
  );
  const [schema, setSchema] = useState<CheckResultSchema | null>(
    initial.schema
  );
  const [editMode, setEditMode] = useState<'form' | 'json'>(initial.editMode);
  const [jsonText, setJsonText] = useState<string>(value);
  const [validationErrors, setValidationErrors] = useState<string[]>(
    initial.validationErrors
  );
  const [isJsonValid, setIsJsonValid] = useState(initial.isJsonValid);

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
            'Changing the type will reset the current data. Continue?'
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
        setIsJsonValid(true);
        onChange(newJson);
      }
      setEditMode('form');
    },
    [schema, resultType, onChange]
  );

  // フォーム編集ハンドラー
  const handleFormChange = useCallback(
    (newSchema: CheckResultSchema) => {
      setSchema(newSchema);
      const newType = detectCheckResultType(newSchema);
      setResultType(newType);
      const errors = validateCheckResult(newSchema);
      setValidationErrors(errors);
      setIsJsonValid(true);
      const newJson = serializeCheckResult(newSchema);
      setJsonText(newJson);
      onChange(newJson);
    },
    [onChange]
  );

  // JSON テキスト編集ハンドラー
  const handleJsonChange = useCallback(
    (newJson: string) => {
      setJsonText(newJson);
      // 空は「check なし」。サーバ側では .check.json の削除を意味する
      if (newJson.trim() === '') {
        setSchema(null);
        setResultType('unknown');
        setValidationErrors([]);
        setIsJsonValid(true);
        onChange('');
        return;
      }
      const parsed = parseCheckResult(newJson);
      if (parsed) {
        setSchema(parsed.schema);
        setResultType(parsed.resultType);
        setIsJsonValid(true);
        if (parsed.schema) {
          const errors = validateCheckResult(parsed.schema);
          setValidationErrors(errors);
        } else {
          setValidationErrors([]);
        }
        onChange(newJson);
      } else {
        // 不正な JSON の間は onChange を呼ばない。isJsonValid を false にして保存を防ぐ
        setValidationErrors(['Invalid JSON syntax']);
        setIsJsonValid(false);
      }
    },
    [onChange]
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
    isJsonValid,
    handleTypeChange,
    handleFormChange,
    handleJsonChange,
    handleModeChange,
  };
}
