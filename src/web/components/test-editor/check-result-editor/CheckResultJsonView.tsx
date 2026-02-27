import React from 'react';
import { Textarea } from '../../common/Textarea';

export interface CheckResultJsonViewProps {
  value: string;
  onChange: (json: string) => void;
  errors?: string[];
  disabled?: boolean;
}

/** check.json を直接 JSON テキストとして編集するビュー */
export const CheckResultJsonView: React.FC<CheckResultJsonViewProps> = ({
  value,
  onChange,
  errors,
  disabled,
}) => (
  <div className="check-result-json-view">
    <Textarea
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
