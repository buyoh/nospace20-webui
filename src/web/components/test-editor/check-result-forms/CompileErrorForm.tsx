import React from 'react';
import { CompileErrorSchema } from '../../../../interfaces/CheckResultSchema';

/** CompileErrorForm のプロパティ */
interface CompileErrorFormProps {
  schema: CompileErrorSchema;
  onChange: (schema: CompileErrorSchema) => void;
  disabled?: boolean;
}

/**
 * コンパイルエラーの期待結果（contains 配列）を編集するフォームコンポーネント
 */
export const CompileErrorForm: React.FC<CompileErrorFormProps> = ({
  schema,
  onChange,
  disabled,
}) => {
  const handleSubstringChange = (index: number, value: string) => {
    const newContains = [...schema.contains];
    newContains[index] = value;
    onChange({ ...schema, contains: newContains });
  };

  const handleAddSubstring = () => {
    onChange({ ...schema, contains: [...schema.contains, ''] });
  };

  const handleRemoveSubstring = (index: number) => {
    const newContains = schema.contains.filter((_, i) => i !== index);
    onChange({ ...schema, contains: newContains });
  };

  return (
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
  );
};
