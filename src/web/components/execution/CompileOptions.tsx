import React, { useMemo } from 'react';
import { useAtom } from 'jotai';
import { compileOptionsAtom } from '../../stores/optionsAtom';
import type { LanguageSubset, CompileTarget } from '../../../interfaces/NospaceTypes';
import { getNospace20, isNospace20WasmInitialized } from '../../libs/nospace20/loader';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
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
  stdExtensionOptions?: string[];
  optPassOptions?: string[];
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

const STD_EXTENSION_LABELS: Record<string, string> = {
  debug: 'Debug',
  alloc: 'Alloc',
};

const OPT_PASS_LABELS: Record<string, string> = {
  all: 'All',
  'condition-opt': 'Condition Opt',
  'geti-opt': 'GetI Opt',
  'constant-folding': 'Constant Folding',
  'dead-code': 'Dead Code',
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

const FALLBACK_STD_EXTENSION_OPTIONS: string[] = ['debug', 'alloc'];
const FALLBACK_OPT_PASS_OPTIONS: string[] = ['all', 'condition-opt', 'geti-opt', 'constant-folding', 'dead-code'];

/**
 * WASM の getOptions() から利用可能なオプションを取得する。
 * WASM が未初期化の場合はフォールバック値を返す。
 */
function getWasmDerivedOptions(): {
  languageOptions: OptionItem<LanguageSubset>[];
  targetOptions: OptionItem<CompileTarget>[];
  stdExtensionOptions: string[];
  optPassOptions: string[];
} {
  if (!isNospace20WasmInitialized()) {
    return {
      languageOptions: FALLBACK_LANGUAGE_OPTIONS,
      targetOptions: FALLBACK_TARGET_OPTIONS,
      stdExtensionOptions: FALLBACK_STD_EXTENSION_OPTIONS,
      optPassOptions: FALLBACK_OPT_PASS_OPTIONS,
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
      stdExtensionOptions: [...opts.stdExtensions],
      optPassOptions: [...opts.optPasses],
    };
  } catch {
    return {
      languageOptions: FALLBACK_LANGUAGE_OPTIONS,
      targetOptions: FALLBACK_TARGET_OPTIONS,
      stdExtensionOptions: FALLBACK_STD_EXTENSION_OPTIONS,
      optPassOptions: FALLBACK_OPT_PASS_OPTIONS,
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
  const stdExtensionOptions = props.stdExtensionOptions ?? wasmOptions.stdExtensionOptions;
  const optPassOptions = props.optPassOptions ?? wasmOptions.optPassOptions;
  const [options, setOptions] = useAtom(compileOptionsAtom);

  /** チェックボックスの ON/OFF で stdExtensions 配列を更新するハンドラ */
  const handleStdExtensionChange = (ext: string, checked: boolean) => {
    const next = checked
      ? [...options.stdExtensions, ext]
      : options.stdExtensions.filter((e) => e !== ext);
    setOptions({ ...options, stdExtensions: next });
  };

  /** チェックボックスの ON/OFF で optPasses 配列を更新するハンドラ */
  const handleOptPassChange = (pass: string, checked: boolean) => {
    const current = options.optPasses ?? [];
    const next = checked
      ? [...current, pass]
      : current.filter((p) => p !== pass);
    setOptions({ ...options, optPasses: next });
  };

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

      {stdExtensionOptions.length > 0 && (
        <div className="option-group">
          <span className="option-group-label">Std Extensions:</span>
          <div className="checkbox-group">
            {stdExtensionOptions.map((ext) => (
              <Checkbox
                key={ext}
                label={STD_EXTENSION_LABELS[ext] ?? ext}
                checked={options.stdExtensions.includes(ext)}
                onChange={(e) => handleStdExtensionChange(ext, e.target.checked)}
              />
            ))}
          </div>
        </div>
      )}

      {optPassOptions.length > 0 && (
        <div className="option-group">
          <span className="option-group-label">Optimization:</span>
          <div className="checkbox-group">
            {optPassOptions.map((pass) => (
              <Checkbox
                key={pass}
                label={OPT_PASS_LABELS[pass] ?? pass}
                checked={(options.optPasses ?? []).includes(pass)}
                onChange={(e) => handleOptPassChange(pass, e.target.checked)}
              />
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};
