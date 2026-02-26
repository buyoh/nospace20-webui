import React from 'react';
import './styles/Button.scss';

type ButtonVariant = 'primary' | 'danger' | 'accent' | 'secondary' | 'outline';
type ButtonSize = 'sm' | 'md';

/** Button コンポーネントの Props */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** ボタンの見た目バリアント。デフォルト: 'primary' */
  variant?: ButtonVariant;
  /** ボタンサイズ。デフォルト: 'md' */
  size?: ButtonSize;
}

/**
 * 共通ボタンコンポーネント。
 * variant / size によりスタイルを制御し、ネイティブ button の全属性を透過する。
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}) => (
  <button
    className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`}
    {...rest}
  >
    {children}
  </button>
);
