import React from 'react';
import { useAtom } from 'jotai';
import { compileOptionsAtom } from '../../stores/optionsAtom';
import type { LanguageSubset, CompileTarget } from '../../../interfaces/NospaceTypes';
import './styles/CompileOptions.scss';

/**
 * コンパイルオプション設定コンポーネント。
 * WASM flavor でのみ使用される。
 */
export const CompileOptions: React.FC = () => {
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
            <option value="standard">Standard</option>
            <option value="min">Minimal</option>
            <option value="ws">Whitespace</option>
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
            <option value="ws">Whitespace</option>
            <option value="mnemonic">Mnemonic</option>
            <option value="ex-ws">Extended Whitespace</option>
            <option value="json">JSON</option>
          </select>
        </label>
      </div>
    </div>
  );
};
