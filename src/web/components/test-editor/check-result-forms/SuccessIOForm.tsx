import React from 'react';
import {
  SuccessIOSchema,
  SuccessIOSingleSchema,
  SuccessIOMultiSchema,
} from '../../../../interfaces/CheckResultSchema';
import { RadioGroup } from '../../common/RadioGroup';
import { Textarea } from '../../common/Textarea';
import { TextInput } from '../../common/TextInput';
import { Button } from '../../common/Button';

interface SuccessIOFormProps {
  schema: SuccessIOSchema;
  onChange: (schema: SuccessIOSchema) => void;
  disabled?: boolean;
}

/**
 * IO ベース検証（stdin/stdout）を編集するフォームコンポーネント。
 * 単一ケースと複数ケースのモード切り替えをサポートする。
 *
 * isSingleMode は schema から直接算出する（controlled component として扱う）。
 * useState で管理すると、親が schema を更新するまでの間に内部状態と
 * schema の不整合が生じてクラッシュするため。
 */
export const SuccessIOForm: React.FC<SuccessIOFormProps> = ({
  schema,
  onChange,
  disabled,
}) => {
  // schema が真のソースなので、プロップから都度算出する
  const isSingleMode = !('cases' in schema);

  const handleModeChange = (single: boolean) => {
    if (single) {
      // 複数 → 単一: 最初のケースのデータを引き継ぐ
      const multiSchema = schema as SuccessIOMultiSchema;
      const firstCase = multiSchema.cases?.[0];
      onChange({
        type: 'success_io',
        stdin: firstCase?.stdin ?? '',
        stdout: firstCase?.stdout ?? '',
      });
    } else {
      // 単一 → 複数: 既存データをケースとして引き継ぐ
      const singleSchema = schema as SuccessIOSingleSchema;
      onChange({
        type: 'success_io',
        cases: [
          {
            name: 'case1',
            stdin: singleSchema.stdin ?? '',
            stdout: singleSchema.stdout ?? '',
          },
        ],
      });
    }
  };

  const handleStdinChange = (value: string) => {
    onChange({ ...(schema as SuccessIOSingleSchema), stdin: value });
  };

  const handleStdoutChange = (value: string) => {
    onChange({ ...(schema as SuccessIOSingleSchema), stdout: value });
  };

  const handleCaseNameChange = (index: number, value: string) => {
    const multiSchema = schema as SuccessIOMultiSchema;
    const newCases = [...multiSchema.cases];
    newCases[index] = { ...newCases[index], name: value };
    onChange({ ...multiSchema, cases: newCases });
  };

  const handleCaseStdinChange = (index: number, value: string) => {
    const multiSchema = schema as SuccessIOMultiSchema;
    const newCases = [...multiSchema.cases];
    newCases[index] = { ...newCases[index], stdin: value };
    onChange({ ...multiSchema, cases: newCases });
  };

  const handleCaseStdoutChange = (index: number, value: string) => {
    const multiSchema = schema as SuccessIOMultiSchema;
    const newCases = [...multiSchema.cases];
    newCases[index] = { ...newCases[index], stdout: value };
    onChange({ ...multiSchema, cases: newCases });
  };

  const handleAddCase = () => {
    const multiSchema = schema as SuccessIOMultiSchema;
    const newCase = {
      name: `case${multiSchema.cases.length + 1}`,
      stdin: '',
      stdout: '',
    };
    onChange({ ...multiSchema, cases: [...multiSchema.cases, newCase] });
  };

  const handleRemoveCase = (index: number) => {
    const multiSchema = schema as SuccessIOMultiSchema;
    const newCases = multiSchema.cases.filter((_, i) => i !== index);
    onChange({ ...multiSchema, cases: newCases });
  };

  return (
    <div className="success-io-form">
      <RadioGroup
        name="io-mode"
        options={[
          { value: 'single', label: 'Single Case' },
          { value: 'multi', label: 'Multiple Cases' },
        ]}
        value={isSingleMode ? 'single' : 'multi'}
        onChange={(v) => handleModeChange(v === 'single')}
        disabled={disabled}
        className="mode-selector"
      />

      {isSingleMode ? (
        <div className="single-case">
          <label>Standard Input (stdin)</label>
          <Textarea
            value={(schema as SuccessIOSingleSchema).stdin}
            onChange={(e) => handleStdinChange(e.target.value)}
            disabled={disabled}
          />
          <label>Expected Output (stdout)</label>
          <Textarea
            value={(schema as SuccessIOSingleSchema).stdout}
            onChange={(e) => handleStdoutChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="multi-cases">
          {(schema as SuccessIOMultiSchema).cases.map((testCase, index) => (
            <div key={index} className="case-item">
              <div className="case-header">
                <TextInput
                  type="text"
                  placeholder="Case name"
                  value={testCase.name}
                  onChange={(e) => handleCaseNameChange(index, e.target.value)}
                  disabled={disabled}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveCase(index)}
                  disabled={disabled}
                >
                  × Remove
                </Button>
              </div>
              <label>stdin</label>
              <Textarea
                value={testCase.stdin}
                onChange={(e) => handleCaseStdinChange(index, e.target.value)}
                disabled={disabled}
              />
              <label>stdout</label>
              <Textarea
                value={testCase.stdout}
                onChange={(e) => handleCaseStdoutChange(index, e.target.value)}
                disabled={disabled}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCase}
            disabled={disabled}
          >
            + Add Case
          </Button>
        </div>
      )}
    </div>
  );
};
