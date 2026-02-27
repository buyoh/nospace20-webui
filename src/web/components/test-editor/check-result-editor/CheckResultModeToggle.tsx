import React from 'react';
import { RadioGroup } from '../../common/RadioGroup';

export interface CheckResultModeToggleProps {
  mode: 'form' | 'json';
  onChange: (mode: 'form' | 'json') => void;
  disabled?: boolean;
}

const CHECK_RESULT_MODE_OPTIONS = [
  { value: 'form', label: 'Form' },
  { value: 'json', label: 'JSON Text' },
] as const;

/** Form / JSON Text 編集モードを切り替えるラジオボタングループ */
export const CheckResultModeToggle: React.FC<CheckResultModeToggleProps> = ({
  mode,
  onChange,
  disabled,
}) => (
  <RadioGroup
    name="edit-mode"
    options={CHECK_RESULT_MODE_OPTIONS}
    value={mode}
    onChange={onChange}
    disabled={disabled}
    className="check-result-mode-toggle"
  />
);
