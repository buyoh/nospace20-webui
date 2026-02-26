import React from 'react';
import { SuccessTraceSchema } from '../../../../interfaces/CheckResultSchema';
import { TextInput } from '../../common/TextInput';
import { Button } from '../../common/Button';

interface SuccessTraceFormProps {
  schema: SuccessTraceSchema;
  onChange: (schema: SuccessTraceSchema) => void;
  disabled?: boolean;
}

/**
 * trace_hit_counts 配列を編集するフォームコンポーネント
 */
export const SuccessTraceForm: React.FC<SuccessTraceFormProps> = ({
  schema,
  onChange,
  disabled,
}) => {
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

  return (
    <div className="success-trace-form">
      <label>Trace Hit Counts</label>
      <div className="array-editor">
        {schema.trace_hit_counts.map((count, index) => (
          <div key={index} className="array-item">
            <TextInput
              type="number"
              value={count}
              onChange={(e) =>
                handleCountChange(index, Number(e.target.value))
              }
              disabled={disabled}
              min={0}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRemoveCount(index)}
              disabled={disabled || schema.trace_hit_counts.length === 1}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddCount}
          disabled={disabled}
        >
          + Add
        </Button>
      </div>
    </div>
  );
};
