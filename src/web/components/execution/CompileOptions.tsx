import React, { useMemo } from 'react';
import { useAtom } from 'jotai';
import { compileOptionsAtom } from '../../stores/optionsAtom';
import type { LanguageSubset, CompileTarget } from '../../../interfaces/NospaceTypes';
import { getNospace20, isNospace20WasmInitialized } from '../../libs/nospace20/loader';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Select } from '../common/Select';
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

/** 値からラベルへのマッピング。未知の値はそのまま表示する */
const LANGUAGE_LABELS: Record<string, string> = {
  standard: 'Standard',
  min: 'Minimal',
  ws: 'Whitespace',
};

const TARGET_LABELS: Record<string, string> = {
  ws: 'Whitespace',
  mnemonic: 'Mnemonic',
};

/** WASM getOptions() が返す値を UI 用の OptionItem 配列に変換するフォールバック付きヘルパー */
const FALLBACK_LANGUAGE_OPTIONS: OptionItem<LanguageSubset>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'min', label: 'Minimal' },
  { value: 'ws', label: 'Whitespace' },
];

const FALLBACK_TARGET_OPTIONS: OptionItem<CompileTarget>[] = [
  { value: 'ws', label: 'Whitespace' },
  { value: 'mnemonic', label: 'Mnemonic' },
];

/**
 * WASM の getOptions() から利用可能なオプションを取得する。
 * WASM が未初期化の場合はフォールバック値を返す。
 */
function getWasmDerivedOptions(): {
  languageOptions: OptionItem<LanguageSubset>[];
  targetOptions: OptionItem<CompileTarget>[];
} {
  if (!isNospace20WasmInitialized()) {
    return {
      languageOptions: FALLBACK_LANGUAGE_OPTIONS,
      targetOptions: FALLBACK_TARGET_OPTIONS,
    };
  }
  try {
    const opts = getNospace20().getOptions();
    return {
      languageOptions: opts.languageStds.map((v) => ({
        value: v as LanguageSubset,
        label: LANGUAGE_LABELS[v] ?? v,
      })),
      targetOptions: opts.compileTargets.map((v) => ({
        value: v as CompileTarget,
        label: TARGET_LABELS[v] ?? v,
      })),
    };
  } catch {
    return {
      languageOptions: FALLBACK_LANGUAGE_OPTIONS,
      targetOptions: FALLBACK_TARGET_OPTIONS,
    };
  }
}

/**
 * コンパイルオプション設定コンポーネント。
 * WASM flavor でのみ使用される。
 * WASM の getOptions() から利用可能なオプションを自動取得する。
 * languageOptions/targetOptions を props で注入することで選択肢をカスタマイズできる。
 */
export const CompileOptions: React.FC<CompileOptionsProps> = (props) => {
  const wasmOptions = useMemo(() => getWasmDerivedOptions(), []);
  const languageOptions = props.languageOptions ?? wasmOptions.languageOptions;
  const targetOptions = props.targetOptions ?? wasmOptions.targetOptions;
  const [options, setOptions] = useAtom(compileOptionsAtom);

  return (
    <CollapsibleSection title="Compile Options" className="compile-options">
      <div className="option-group">
        <label>
          <span>Language:</span>
          <Select
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
          </Select>
        </label>
      </div>

      <div className="option-group">
        <label>
          <span>Target:</span>
          <Select
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
          </Select>
        </label>
      </div>
    </CollapsibleSection>
  );
};
