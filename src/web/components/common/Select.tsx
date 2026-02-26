import React from 'react';
import './styles/Select.scss';

/** Select コンポーネントの Props */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * 共通 select コンポーネント。
 * common-select クラスで統一スタイルを適用する。children（option 要素）をそのまま透過する。
 */
export const Select: React.FC<SelectProps> = ({
  className,
  children,
  ...rest
}) => (
  <select
    className={`common-select${className ? ` ${className}` : ''}`}
    {...rest}
  >
    {children}
  </select>
);
