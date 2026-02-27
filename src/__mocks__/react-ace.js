// react-ace のテスト用スタブ (moduleNameMapper 経由で使用)
// NospaceEditor に AceEditorComponent prop を渡さない場合のフォールバックとして使われる
const React = require('react');

const AceEditorStub = (_props) =>
  React.createElement('div', { 'data-testid': 'stub-ace-editor' });
AceEditorStub.displayName = 'AceEditorStub';

module.exports = AceEditorStub;
