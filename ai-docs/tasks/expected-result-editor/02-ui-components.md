# Expected Result: UI コンポーネント設計

## 概要

check.json の構造化エディタ UI を実装する React コンポーネント群の設計。

## コンポーネント構成

```
CheckResultEditor                        ← メインコンポーネント
├── CheckResultTypeSelector              ← 型選択ドロップダウン
├── CheckResultModeToggle                ← Form/JSON Text モード切り替え
├── (分岐)
│   ├── CheckResultFormView              ← 構造化フォームビュー
│   │   ├── SuccessTraceForm             ← trace_hit_counts 編集
│   │   ├── SuccessIOForm                ← stdin/stdout 編集
│   │   ├── CompileErrorForm             ← contains 編集
│   │   └── ParseErrorForm               ← phase + contains 編集
│   └── CheckResultJsonView              ← JSON テキストエディタ
└── CheckResultPreview (オプション)       ← JSON プレビュー
```

## 新規ファイル

| ファイル | 説明 |
|---------|------|
| `src/web/components/test-editor/CheckResultEditor.tsx` | メインエディタコンポーネント |
| `src/web/components/test-editor/check-result-forms/SuccessTraceForm.tsx` | trace_hit_counts 編集フォーム |
| `src/web/components/test-editor/check-result-forms/SuccessIOForm.tsx` | IO 検証編集フォーム |
| `src/web/components/test-editor/check-result-forms/CompileErrorForm.tsx` | コンパイルエラーフォーム |
| `src/web/components/test-editor/check-result-forms/ParseErrorForm.tsx` | パースエラーフォーム |
| `src/web/components/test-editor/styles/CheckResultEditor.scss` | スタイル |
| `src/tests/web/components/test-editor/CheckResultEditor.test.tsx` | ユニットテスト |

## コンポーネント詳細

### 1. CheckResultEditor（親コンポーネント）

#### Props

```typescript
interface CheckResultEditorProps {
  /** 編集中の JSON 文字列 */
  value: string;
  /** 値が変更されたときのコールバック */
  onChange: (json: string) => void;
  /** 無効化フラグ（保存中など） */
  disabled?: boolean;
}
```

#### State

```typescript
interface CheckResultEditorState {
  /** 現在のスキーマ型 */
  resultType: CheckResultType;
  /** パースされたスキーマ */
  schema: CheckResultSchema | null;
  /** 編集モード: 'form' | 'json' */
  editMode: 'form' | 'json';
  /** JSON エディタ用の生文字列（form モード時は内部で生成） */
  jsonText: string;
  /** バリデーションエラー */
  validationErrors: string[];
}
```

#### 処理フロー

1. **初期化**（`useEffect`）:
   - `props.value` を `parseCheckResult()` でパース
   - `resultType` と `schema` を state にセット
   - `resultType === 'unknown'` なら `editMode = 'json'` に強制

2. **型変更**（`handleTypeChange`）:
   - 既存データがある場合は警告ダイアログを表示
   - 新しい型の空スキーマを `createEmptySchema()` で生成
   - `editMode = 'form'` に切り替え

3. **フォーム編集**（`handleFormChange`）:
   - 子フォームから `schema` を受け取る
   - `validateCheckResult()` でバリデーション
   - `serializeCheckResult()` で JSON に変換して `onChange()` を呼ぶ

4. **JSON テキスト編集**（`handleJsonChange`）:
   - `jsonText` を更新
   - `parseCheckResult()` でパースを試行
   - パース成功 → `onChange()` を呼ぶ
   - パース失敗 → エラーメッセージを表示（保存はブロックしない）

#### UI レイアウト

```tsx
<div className="check-result-editor">
  <div className="editor-header">
    <CheckResultTypeSelector
      value={resultType}
      onChange={handleTypeChange}
      disabled={disabled || editMode === 'json'}
    />
    <CheckResultModeToggle
      mode={editMode}
      onChange={setEditMode}
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

  {/* オプション: JSON プレビュー */}
  {editMode === 'form' && (
    <div className="editor-preview">
      <CheckResultPreview json={jsonText} />
    </div>
  )}
</div>
```

---

### 2. CheckResultTypeSelector

#### Props

```typescript
interface CheckResultTypeSelectorProps {
  value: CheckResultType;
  onChange: (type: CheckResultType) => void;
  disabled?: boolean;
}
```

#### UI

```tsx
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
```

---

### 3. CheckResultModeToggle

#### Props

```typescript
interface CheckResultModeToggleProps {
  mode: 'form' | 'json';
  onChange: (mode: 'form' | 'json') => void;
  disabled?: boolean;
}
```

#### UI

```tsx
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
```

---

### 4. CheckResultFormView（フォーム分岐コンポーネント）

#### Props

```typescript
interface CheckResultFormViewProps {
  type: CheckResultType;
  schema: CheckResultSchema;
  onChange: (schema: CheckResultSchema) => void;
  disabled?: boolean;
}
```

#### 実装

```tsx
export const CheckResultFormView: React.FC<CheckResultFormViewProps> = ({
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
```

---

### 5. SuccessTraceForm

#### Props

```typescript
interface SuccessTraceFormProps {
  schema: SuccessTraceSchema;
  onChange: (schema: SuccessTraceSchema) => void;
  disabled?: boolean;
}
```

#### UI

```tsx
<div className="success-trace-form">
  <label>Trace Hit Counts</label>
  <div className="array-editor">
    {schema.trace_hit_counts.map((count, index) => (
      <div key={index} className="array-item">
        <input
          type="number"
          value={count}
          onChange={(e) => handleCountChange(index, Number(e.target.value))}
          disabled={disabled}
          min={0}
        />
        <button
          onClick={() => handleRemoveCount(index)}
          disabled={disabled || schema.trace_hit_counts.length === 1}
        >
          ×
        </button>
      </div>
    ))}
    <button onClick={handleAddCount} disabled={disabled}>
      + Add
    </button>
  </div>
</div>
```

#### ハンドラー

```typescript
const handleCountChange = (index: number, value: number) => {
  const newCounts = [...schema.trace_hit_counts];
  newCounts[index] = value;
  onChange({ ...schema, trace_hit_counts: newCounts });
};

const handleAddCount = () => {
  onChange({
    ...schema,
    trace_hit_counts: [...schema.trace_hit_counts, 1],
  });
};

const handleRemoveCount = (index: number) => {
  const newCounts = schema.trace_hit_counts.filter((_, i) => i !== index);
  onChange({ ...schema, trace_hit_counts: newCounts });
};
```

---

### 6. SuccessIOForm

#### Props

```typescript
interface SuccessIOFormProps {
  schema: SuccessIOSchema;
  onChange: (schema: SuccessIOSchema) => void;
  disabled?: boolean;
}
```

#### State

```typescript
const [isSingleMode, setIsSingleMode] = useState<boolean>(
  'cases' in schema ? false : true
);
```

#### UI

```tsx
<div className="success-io-form">
  <div className="mode-selector">
    <label>
      <input
        type="radio"
        name="io-mode"
        checked={isSingleMode}
        onChange={() => handleModeChange(true)}
        disabled={disabled}
      />
      Single Case
    </label>
    <label>
      <input
        type="radio"
        name="io-mode"
        checked={!isSingleMode}
        onChange={() => handleModeChange(false)}
        disabled={disabled}
      />
      Multiple Cases
    </label>
  </div>

  {isSingleMode ? (
    <div className="single-case">
      <label>Standard Input (stdin)</label>
      <textarea
        value={(schema as SuccessIOSingleSchema).stdin}
        onChange={(e) => handleStdinChange(e.target.value)}
        disabled={disabled}
      />
      <label>Expected Output (stdout)</label>
      <textarea
        value={(schema as SuccessIOSingleSchema).stdout}
        onChange={(e) => handleStdoutChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  ) : (
    <div className="multi-cases">
      {(schema as SuccessIOMultiSchema).cases.map((testCase, index) => (
        <div key={index} className="case-item">
          <div className="case-header">
            <input
              type="text"
              placeholder="Case name"
              value={testCase.name}
              onChange={(e) => handleCaseNameChange(index, e.target.value)}
              disabled={disabled}
            />
            <button
              onClick={() => handleRemoveCase(index)}
              disabled={disabled}
            >
              × Remove
            </button>
          </div>
          <label>stdin</label>
          <textarea
            value={testCase.stdin}
            onChange={(e) => handleCaseStdinChange(index, e.target.value)}
            disabled={disabled}
          />
          <label>stdout</label>
          <textarea
            value={testCase.stdout}
            onChange={(e) => handleCaseStdoutChange(index, e.target.value)}
            disabled={disabled}
          />
        </div>
      ))}
      <button onClick={handleAddCase} disabled={disabled}>
        + Add Case
      </button>
    </div>
  )}
</div>
```

---

### 7. CompileErrorForm

#### Props

```typescript
interface CompileErrorFormProps {
  schema: CompileErrorSchema;
  onChange: (schema: CompileErrorSchema) => void;
  disabled?: boolean;
}
```

#### UI

```tsx
<div className="compile-error-form">
  <label>Error Message Substrings</label>
  <div className="array-editor">
    {schema.contains.map((substring, index) => (
      <div key={index} className="array-item">
        <input
          type="text"
          value={substring}
          onChange={(e) => handleSubstringChange(index, e.target.value)}
          disabled={disabled}
        />
        <button
          onClick={() => handleRemoveSubstring(index)}
          disabled={disabled || schema.contains.length === 1}
        >
          ×
        </button>
      </div>
    ))}
    <button onClick={handleAddSubstring} disabled={disabled}>
      + Add
    </button>
  </div>
</div>
```

---

### 8. ParseErrorForm

#### Props

```typescript
interface ParseErrorFormProps {
  schema: ParseErrorSchema;
  onChange: (schema: ParseErrorSchema) => void;
  disabled?: boolean;
}
```

#### UI

```tsx
<div className="parse-error-form">
  <label>Phase</label>
  <div className="radio-group">
    <label>
      <input
        type="radio"
        name="phase"
        value="tree"
        checked={schema.phase === 'tree'}
        onChange={() => handlePhaseChange('tree')}
        disabled={disabled}
      />
      Tree
    </label>
    <label>
      <input
        type="radio"
        name="phase"
        value="tokenize"
        checked={schema.phase === 'tokenize'}
        onChange={() => handlePhaseChange('tokenize')}
        disabled={disabled}
      />
      Tokenize
    </label>
  </div>

  <label>Error Details (optional)</label>
  <div className="array-editor">
    {(schema.contains || []).map((detail, index) => (
      <div key={index} className="array-item">
        <input
          type="text"
          value={detail}
          onChange={(e) => handleDetailChange(index, e.target.value)}
          disabled={disabled}
        />
        <button onClick={() => handleRemoveDetail(index)} disabled={disabled}>
          ×
        </button>
      </div>
    ))}
    <button onClick={handleAddDetail} disabled={disabled}>
      + Add
    </button>
  </div>
</div>
```

---

### 9. CheckResultJsonView

#### Props

```typescript
interface CheckResultJsonViewProps {
  value: string;
  onChange: (json: string) => void;
  errors?: string[];
  disabled?: boolean;
}
```

#### UI

```tsx
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
```

---

### 10. CheckResultPreview（オプション）

#### Props

```typescript
interface CheckResultPreviewProps {
  json: string;
}
```

#### UI

```tsx
<div className="check-result-preview">
  <h4>JSON Preview</h4>
  <pre className="json-preview-content">{json}</pre>
</div>
```

---

## スタイルガイド

### `src/web/components/test-editor/styles/CheckResultEditor.scss`

```scss
.check-result-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .editor-header {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .editor-body {
    flex: 1;
    overflow: auto;
  }

  .editor-preview {
    border-top: 1px solid #ccc;
    padding-top: 1rem;
    max-height: 200px;
    overflow: auto;
  }
}

.check-result-type-selector {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.check-result-mode-toggle {
  display: flex;
  gap: 1rem;

  label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
}

.array-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  .array-item {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    button {
      padding: 0.25rem 0.5rem;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;

      &:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
    }
  }
}

.success-io-form {
  .mode-selector {
    margin-bottom: 1rem;
    display: flex;
    gap: 1rem;
  }

  .single-case,
  .multi-cases {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .case-item {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1rem;

    .case-header {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;

      input {
        flex: 1;
      }
    }
  }

  textarea {
    width: 100%;
    min-height: 80px;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
  }
}

.check-result-json-view {
  .json-editor {
    width: 100%;
    min-height: 300px;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
  }

  .validation-errors {
    margin-top: 1rem;
    padding: 0.5rem;
    background: #ffebee;
    border: 1px solid #f44336;
    border-radius: 4px;

    .error-message {
      color: #c62828;
      font-size: 0.875rem;
    }
  }
}

.check-result-preview {
  h4 {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }

  .json-preview-content {
    background: #f5f5f5;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.875rem;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
```

## 既存コンポーネントの変更

### `TestCaseEditForm.tsx`

```tsx
// Before
<textarea
  className="check-editor"
  value={testCase.check || ''}
  onChange={(e) => onCheckChange(e.target.value)}
  disabled={isSaving}
/>

// After
<CheckResultEditor
  value={testCase.check || ''}
  onChange={onCheckChange}
  disabled={isSaving}
/>
```

## まとめ

- 各スキーマ型ごとに独立したフォームコンポーネントを作成
- 配列編集（trace_hit_counts, cases, contains）は動的な追加・削除をサポート
- JSON Text モードはフォールバックとして常に利用可能
- バリデーションエラーは UI に表示するが、保存はブロックしない（柔軟性のため）
