import React from 'react';
import { useAtom } from 'jotai';
import { executionOptionsAtom } from '../../stores/optionsAtom';
import './styles/ExecutionOptions.scss';

export const ExecutionOptions: React.FC = () => {
  const [options, setOptions] = useAtom(executionOptionsAtom);

  return (
    <div className="execution-options">
      <h3>Execution Options</h3>
      <div className="option-group">
        <label>
          <input
            type="checkbox"
            checked={options.debug}
            onChange={(e) =>
              setOptions({ ...options, debug: e.target.checked })
            }
          />
          <span>Debug trace (--debug)</span>
        </label>
      </div>
      <div className="option-group">
        <label>
          <input
            type="checkbox"
            checked={options.ignoreDebug}
            onChange={(e) =>
              setOptions({ ...options, ignoreDebug: e.target.checked })
            }
          />
          <span>Ignore debug functions (--ignore-debug)</span>
        </label>
      </div>
      <div className="option-group">
        <label>
          <span>Input Mode:</span>
          <select
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
          </select>
        </label>
      </div>
    </div>
  );
};
