import React from 'react';
import { useAtom } from 'jotai';
import { compileOptionsAtom } from '../../stores/optionsAtom';
import type { LanguageSubset, CompileTarget } from '../../../interfaces/NospaceTypes';
import './styles/CompileOptions.scss';

/** 選択肢の定義 */
interface OptionItem<T extends string> {
  value: T;
  label: string;
}

/** CompileOptions の Props。省略時はデフォルト値を使用 */
interface CompileOptionsProps {
  languageOptions?: OptionItem<LanguageSubset>[];
  targetOptions?: OptionItem<CompileTarget>[];
}

/** デフォルトの Language 選択肢 */
const DEFAULT_LANGUAGE_OPTIONS: OptionItem<LanguageSubset>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'min', label: 'Minimal' },
  { value: 'ws', label: 'Whitespace' },
];

/** デフォルトの Target 選択肢 */
const DEFAULT_TARGET_OPTIONS: OptionItem<CompileTarget>[] = [
  { value: 'ws', label: 'Whitespace' },
  { value: 'mnemonic', label: 'Mnemonic' },
];

/**
 * コンパイルオプション設定コンポーネント。
 * WASM flavor でのみ使用される。
 * languageOptions/targetOptions を props で注入することで選択肢をカスタマイズできる。
 */
export const CompileOptions: React.FC<CompileOptionsProps> = ({
  languageOptions = DEFAULT_LANGUAGE_OPTIONS,
  targetOptions = DEFAULT_TARGET_OPTIONS,
}) => {
  const [options, setOptions] = useAtom(compileOptionsAtom);

  return (
    <div className="compile-options">
      <h3>Compile Options</h3>

      <div className="option-group">
        <label>
          <span>Language:</span>
          <select
            value={options.language}
            onChange={(e) =>
              setOptions({
                ...options,
                language: e.target.value as LanguageSubset,
              })
            }
          >
            {languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="option-group">
        <label>
          <span>Target:</span>
          <select
            value={options.target}
            onChange={(e) =>
              setOptions({
                ...options,
                target: e.target.value as CompileTarget,
              })
            }
          >
            {targetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};
