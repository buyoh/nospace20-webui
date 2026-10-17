import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TestCaseCreateForm } from '../../web/components/test-editor/TestCaseCreateForm';
import { MAX_TEST_PATH_DEPTH } from '../../interfaces/TestTypes';

function renderForm(categories = ['passes']) {
  const onSubmit = jest.fn();
  render(
    <TestCaseCreateForm
      categories={categories}
      source="print 1"
      onSubmit={onSubmit}
      onCancel={jest.fn()}
      isSaving={false}
    />
  );
  return { onSubmit };
}

const fileNameInput = () => screen.getByPlaceholderText('e.g., test_001');

describe('TestCaseCreateForm のファイル名検証', () => {
  it('英数字・アンダースコア・ハイフンのファイル名なら作成できる', () => {
    const { onSubmit } = renderForm();

    fireEvent.change(fileNameInput(), { target: { value: 'arith_004-b' } });
    fireEvent.click(screen.getByText('Create'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it.each(['a/b', '../x', 'a b', 'a#b', 'a.b'])(
    'BUG: 使えない文字を含むファイル名（%s）は作成を無効にし、理由を表示する',
    (name) => {
      renderForm();

      fireEvent.change(fileNameInput(), { target: { value: name } });

      expect(screen.getByText('Create')).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('letters, digits');
    }
  );

  it('カテゴリが深すぎる場合は作成を無効にする', () => {
    const tooDeep = Array.from(
      { length: MAX_TEST_PATH_DEPTH },
      (_, i) => `d${i}`
    ).join('/');
    renderForm([tooDeep]);

    fireEvent.change(fileNameInput(), { target: { value: 'ok' } });

    expect(screen.getByText('Create')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('too deep');
  });
});
