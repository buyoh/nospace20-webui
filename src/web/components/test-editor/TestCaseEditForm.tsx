import React, { useState } from 'react';
import { CheckResultEditor } from './CheckResultEditor';
import { Button } from '../common/Button';
import './styles/TestCaseEditForm.scss';

/** TestCaseEditForm のプロパティ */
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
 * このフォームでは期待結果 (.check.json) のみを編集する。
 * 編集対象のテストケースを切り替えるときは、親が key（path）を変えて remount する。
 */
export const TestCaseEditForm: React.FC<TestCaseEditFormProps> = ({
  testCase,
  isDirty,
  isSaving,
  onCheckChange,
  onSave,
}) => {
  // 不正な JSON の間は onChange が呼ばれず、保存すると最後に有効だった内容が保存されてしまうため、
  // エディタからの通知で保存を無効化する
  const [checkValid, setCheckValid] = useState(true);

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
            onValidityChange={setCheckValid}
            disabled={isSaving}
          />
          {!checkValid && (
            <div className="form-hint form-hint--error" role="alert">
              Fix JSON syntax errors before saving
            </div>
          )}
          <div className="form-hint">
            Saving with an empty value deletes the .check.json file
          </div>
        </div>
      </div>
      <div className="form-footer">
        <Button
          variant="primary"
          className="btn-save"
          onClick={onSave}
          disabled={!isDirty || isSaving || !checkValid}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};
