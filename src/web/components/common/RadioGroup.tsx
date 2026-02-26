import React from 'react';
import './styles/RadioGroup.scss';

/** ラジオボタンの選択肢 */
interface RadioOption<T extends string> {
  value: T;
  label: string;
}

/** RadioGroup コンポーネントの Props */
interface RadioGroupProps<T extends string> {
  /** グループ名（HTML name 属性） */
  name: string;
  /** 選択肢 */
  options: RadioOption<T>[];
  /** 現在選択中の値 */
  value: T;
  /** 選択変更時コールバック */
  onChange: (value: T) => void;
  /** 無効化 */
  disabled?: boolean;
  /** 追加クラス */
  className?: string;
}

/**
 * 共通ラジオボタングループコンポーネント。
 * options 配列をもとに横並びのラジオボタン UI をレンダリングする。
 */
export const RadioGroup = <T extends string>({
  name,
  options,
  value,
  onChange,
  disabled,
  className,
}: RadioGroupProps<T>) => (
  <div className={`common-radio-group${className ? ` ${className}` : ''}`}>
    {options.map((opt) => (
      <label key={opt.value}>
        <input
          type="radio"
          name={name}
          value={opt.value}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
          disabled={disabled}
        />
        {opt.label}
      </label>
    ))}
  </div>
);
