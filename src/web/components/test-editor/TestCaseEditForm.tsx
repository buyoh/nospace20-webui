import React from 'react';
import { CheckResultEditor } from './CheckResultEditor';
import { Button } from '../common/Button';
import './styles/TestCaseEditForm.scss';

interface TestCaseEditFormProps {
  testCase: { path: string; source: string; check: string | null };
  isDirty: boolean;
  isSaving: boolean;
  onCheckChange: (check: string) => void;
  onSave: () => void;
}

/**
 * テストケース編集フォーム
 * ソースコード (.ns) はメインエディタに表示されるため、
 * このフォームでは期待結果 (.check.json) のみを編集する
 */
export const TestCaseEditForm: React.FC<TestCaseEditFormProps> = ({
  testCase,
  isDirty,
  isSaving,
  onCheckChange,
  onSave,
}) => {
  return (
    <div className="test-case-edit-form">
      <div className="form-header">
        <h3>{testCase.path}</h3>
      </div>
      <div className="form-body">
        <div className="form-section">
          <label>Expected Result (.check.json)</label>
          <CheckResultEditor
            value={testCase.check || ''}
            onChange={onCheckChange}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="form-footer">
        <Button
          variant="primary"
          className="btn-save"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};
