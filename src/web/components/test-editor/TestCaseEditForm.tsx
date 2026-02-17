import React from 'react';
import { CodeTextarea } from '../editor/CodeTextarea';
import './styles/TestCaseEditForm.scss';

interface TestCaseEditFormProps {
  testCase: { path: string; source: string; check: string | null };
  isDirty: boolean;
  isSaving: boolean;
  onSourceChange: (source: string) => void;
  onCheckChange: (check: string) => void;
  onSave: () => void;
}

/**
 * テストケース編集フォーム
 */
export const TestCaseEditForm: React.FC<TestCaseEditFormProps> = ({
  testCase,
  isDirty,
  isSaving,
  onSourceChange,
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
          <label>Source (.ns)</label>
          <CodeTextarea
            value={testCase.source}
            onChange={onSourceChange}
          />
        </div>
        <div className="form-section">
          <label>Expected Result (.check.json)</label>
          <textarea
            className="check-editor"
            value={testCase.check || ''}
            onChange={(e) => onCheckChange(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="form-footer">
        <button
          className="btn-save"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};
