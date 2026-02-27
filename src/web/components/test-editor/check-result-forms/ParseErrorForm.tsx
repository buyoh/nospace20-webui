import React from 'react';
import { ParseErrorSchema } from '../../../../interfaces/CheckResultSchema';
import { RadioGroup } from '../../common/RadioGroup';
import { TextInput } from '../../common/TextInput';
import { Button } from '../../common/Button';

/** ParseErrorForm のプロパティ */
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
      <RadioGroup
        name="phase"
        options={[
          { value: 'tree', label: 'Tree' },
          { value: 'tokenize', label: 'Tokenize' },
        ]}
        value={schema.phase}
        onChange={(v) => handlePhaseChange(v as 'tree' | 'tokenize')}
        disabled={disabled}
        className="radio-group"
      />

      <label>Error Details (optional)</label>
      <div className="array-editor">
        {(schema.contains || []).map((detail, index) => (
          <div key={index} className="array-item">
            <TextInput
              type="text"
              value={detail}
              onChange={(e) => handleDetailChange(index, e.target.value)}
              disabled={disabled}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRemoveDetail(index)}
              disabled={disabled}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddDetail}
          disabled={disabled}
        >
          + Add
        </Button>
      </div>
    </div>
  );
};
