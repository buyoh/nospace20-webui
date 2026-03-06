import React from 'react';
import './styles/Checkbox.scss';

/** Checkbox コンポーネントの Props（type="checkbox" は固定） */
interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** チェックボックスの横に表示するラベルテキスト */
  label: string;
}

/**
 * 共通チェックボックスコンポーネント。
 * label + input[type="checkbox"] + テキストを 1 つにまとめる。
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className,
  ...rest
}) => (
  <label className={`common-checkbox${className ? ` ${className}` : ''}`}>
    <input type="checkbox" {...rest} />
    <span>{label}</span>
  </label>
);
