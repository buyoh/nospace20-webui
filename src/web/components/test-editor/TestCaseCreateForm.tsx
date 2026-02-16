import React, { useState } from 'react';
import './styles/TestCaseCreateForm.scss';

interface TestCaseCreateFormProps {
  categories: string[];
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
 */
export const TestCaseCreateForm: React.FC<TestCaseCreateFormProps> = ({
  categories,
  onSubmit,
  onCancel,
  isSaving,
}) => {
  const [category, setCategory] = useState(categories[0] || '');
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState('');
  const [check, setCheck] = useState('');

  const handleSubmit = () => {
    if (category && fileName && source) {
      onSubmit({ category, fileName, source, check });
    }
  };

  const isValid = category && fileName && source;

  return (
    <div className="test-case-create-form">
      <div className="form-header">
        <h3>New Test Case</h3>
      </div>
      <div className="form-body">
        <div className="form-section">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSaving}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="form-section">
          <label>File name (without .ns extension)</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="e.g., test_001"
            disabled={isSaving}
          />
        </div>
        <div className="form-section">
          <label>Source (.ns)</label>
          <textarea
            className="source-editor"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="form-section">
          <label>Expected Result (.check.json)</label>
          <textarea
            className="check-editor"
            value={check}
            onChange={(e) => setCheck(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="form-footer">
        <button
          className="btn-create"
          onClick={handleSubmit}
          disabled={!isValid || isSaving}
        >
          {isSaving ? 'Creating...' : 'Create'}
        </button>
        <button className="btn-cancel" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
      </div>
    </div>
  );
};
