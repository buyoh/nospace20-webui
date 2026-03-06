import React from 'react';
import type { CheckResultType } from '../../../../interfaces/CheckResultSchema';
import { Select } from '../../common/Select';

export interface CheckResultTypeSelectorProps {
  value: CheckResultType;
  onChange: (type: CheckResultType) => void;
  disabled?: boolean;
}

/** check.json のスキーマ型を選択するドロップダウン */
export const CheckResultTypeSelector: React.FC<
  CheckResultTypeSelectorProps
> = ({ value, onChange, disabled }) => (
  <Select
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
  </Select>
);
