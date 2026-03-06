import React from 'react';
import './styles/TextInput.scss';

/** TextInput コンポーネントの Props */
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * 共通テキスト入力コンポーネント。
 * common-text-input クラスで統一スタイルを適用する。type は 'text' / 'number' 等を自由に設定可能。
 */
export const TextInput: React.FC<TextInputProps> = ({ className, ...rest }) => (
  <input
    className={`common-text-input${className ? ` ${className}` : ''}`}
    {...rest}
  />
);
