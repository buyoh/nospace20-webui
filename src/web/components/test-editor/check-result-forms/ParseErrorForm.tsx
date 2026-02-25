import React from 'react';
import { ParseErrorSchema } from '../../../../interfaces/CheckResultSchema';

interface ParseErrorFormProps {
  schema: ParseErrorSchema;
  onChange: (schema: ParseErrorSchema) => void;
  disabled?: boolean;
}

/**
 * パースエラーの期待結果（phase + contains 配列）を編集するフォームコンポーネント
 */
export const ParseErrorForm: React.FC<ParseErrorFormProps> = ({
  schema,
  onChange,
  disabled,
}) => {
  const handlePhaseChange = (phase: 'tree' | 'tokenize') => {
    onChange({ ...schema, phase });
  };

  const handleDetailChange = (index: number, value: string) => {
    const newContains = [...(schema.contains || [])];
    newContains[index] = value;
    onChange({ ...schema, contains: newContains });
  };

  const handleAddDetail = () => {
    onChange({ ...schema, contains: [...(schema.contains || []), ''] });
  };

  const handleRemoveDetail = (index: number) => {
    const newContains = (schema.contains || []).filter((_, i) => i !== index);
    // contains が空配列になった場合は undefined にする
    onChange({
      ...schema,
      contains: newContains.length > 0 ? newContains : undefined,
    });
  };

  return (
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
            <button
              onClick={() => handleRemoveDetail(index)}
              disabled={disabled}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={handleAddDetail} disabled={disabled}>
          + Add
        </button>
      </div>
    </div>
  );
};
