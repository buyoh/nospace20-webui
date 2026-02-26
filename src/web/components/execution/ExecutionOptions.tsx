import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../../stores/optionsAtom';
import { flavorAtom } from '../../stores/flavorAtom';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { Select } from '../common/Select';
import { TextInput } from '../common/TextInput';
import { Checkbox } from '../common/Checkbox';
import './styles/ExecutionOptions.scss';

/**
 * 実行オプション設定コンポーネント。
 * Flavor に応じて利用可能なオプションのみを表示する。
 */
export const ExecutionOptions: React.FC = () => {
  const [options, setOptions] = useAtom(executionOptionsAtom);
  const flavor = useAtomValue(flavorAtom);
  const isWasm = flavor === 'wasm';

  return (
    <CollapsibleSection title="Execution Options" className="execution-options">
      {/* Debug trace — 両 flavor で利用可能 */}
      <div className="option-group">
        <Checkbox
          label="Debug trace (--debug)"
          checked={options.debug}
          onChange={(e) =>
            setOptions({ ...options, debug: e.target.checked })
          }
        />
      </div>

      {/* Ignore debug — WebSocket のみ */}
      {!isWasm && (
        <div className="option-group">
          <Checkbox
            label="Ignore debug functions (--ignore-debug)"
            checked={options.ignoreDebug}
            onChange={(e) =>
              setOptions({ ...options, ignoreDebug: e.target.checked })
            }
          />
        </div>
      )}

      {/* Input Mode — WebSocket のみ（WASM は batch 固定） */}
      {!isWasm && (
        <div className="option-group">
          <label>
            <span>Input Mode:</span>
            <Select
              value={options.inputMode}
              onChange={(e) =>
                setOptions({
                  ...options,
                  inputMode: e.target.value as 'batch' | 'interactive',
                })
              }
            >
              <option value="batch">Batch</option>
              <option value="interactive">Interactive</option>
            </Select>
          </label>
        </div>
      )}

      {/* Step Budget — WASM のみ */}
      {isWasm && (
        <div className="option-group">
          <label>
            <span>Step Budget:</span>
            <TextInput
              type="number"
              min={100}
              max={1000000}
              value={options.stepBudget}
              onChange={(e) =>
                setOptions({ ...options, stepBudget: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}

      {/* Max Total Steps — WASM のみ */}
      {isWasm && (
        <div className="option-group">
          <label>
            <span>Max Total Steps:</span>
            <TextInput
              type="number"
              min={1000}
              max={10000000000}
              value={options.maxTotalSteps}
              onChange={(e) =>
                setOptions({ ...options, maxTotalSteps: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}
    </CollapsibleSection>
  );
};
