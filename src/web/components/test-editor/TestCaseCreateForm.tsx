import React, { useState } from 'react';
import { CheckResultEditor } from './CheckResultEditor';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { TextInput } from '../common/TextInput';
import {
  MAX_TEST_PATH_DEPTH,
  TEST_FILE_NAME_PATTERN,
} from '../../../interfaces/TestTypes';
import './styles/TestCaseCreateForm.scss';

/** TestCaseCreateForm のプロパティ */
interface TestCaseCreateFormProps {
  categories: string[];
  source: string;
  onSubmit: (params: {
    category: string;
    fileName: string;
    source: string;
    check: string;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

/**
 * テストケース新規作成フォーム
 * ソースコード (.ns) はメインエディタに表示されるため、
 * このフォームではカテゴリ、ファイル名、期待結果 (.check.json) のみを入力する
 */
export const TestCaseCreateForm: React.FC<TestCaseCreateFormProps> = ({
  categories,
  source,
  onSubmit,
  onCancel,
  isSaving,
}) => {
  const [category, setCategory] = useState(categories[0] || '');
  const [fileName, setFileName] = useState('');
  const [check, setCheck] = useState('');
  const [checkValid, setCheckValid] = useState(true);

  const handleSubmit = () => {
    if (category && fileName && source) {
      onSubmit({ category, fileName, source, check });
    }
  };

  // サーバーが受け付ける形式（英数字・アンダースコア・ハイフン）と深さの上限を、送信前に確認する
  const fileNameValid =
    fileName === '' || TEST_FILE_NAME_PATTERN.test(fileName);
  const depth = (category ? category.split('/').length : 0) + 1;
  const depthValid = depth <= MAX_TEST_PATH_DEPTH;
  const isValid =
    category && fileName && fileNameValid && depthValid && source && checkValid;

  return (
    <div className="test-case-create-form">
      <div className="form-header">
        <h3>New Test Case</h3>
      </div>
      <div className="form-body">
        <div className="form-section">
          <label>Category</label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSaving}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>
        <div className="form-section">
          <label>File name (without .ns extension)</label>
          <TextInput
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="e.g., test_001"
            disabled={isSaving}
          />
          {!fileNameValid && (
            <div className="form-hint form-hint--error" role="alert">
              Use only letters, digits, &quot;_&quot; and &quot;-&quot;
            </div>
          )}
          {!depthValid && (
            <div className="form-hint form-hint--error" role="alert">
              The path is too deep (max {MAX_TEST_PATH_DEPTH} levels)
            </div>
          )}
        </div>
        <div className="form-section">
          <label>Expected Result (.check.json)</label>
          <CheckResultEditor
            value={check}
            onChange={setCheck}
            onValidityChange={setCheckValid}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="form-footer">
        <Button
          variant="primary"
          className="btn-create"
          onClick={handleSubmit}
          disabled={!isValid || isSaving}
        >
          {isSaving ? 'Creating...' : 'Create'}
        </Button>
        <Button
          variant="secondary"
          className="btn-cancel"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
