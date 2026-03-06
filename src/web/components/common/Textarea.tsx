import React from 'react';
import './styles/Textarea.scss';

/** Textarea コンポーネントの Props */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * 共通 textarea コンポーネント。
 * common-textarea クラスで統一スタイルを適用する。
 */
export const Textarea: React.FC<TextareaProps> = ({ className, ...rest }) => (
  <textarea
    className={`common-textarea${className ? ` ${className}` : ''}`}
    {...rest}
  />
);
