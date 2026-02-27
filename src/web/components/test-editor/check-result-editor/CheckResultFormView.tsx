import React from 'react';
import type {
  CheckResultType,
  CheckResultSchema,
  SuccessTraceSchema,
  SuccessIOSchema,
  CompileErrorSchema,
  ParseErrorSchema,
} from '../../../../interfaces/CheckResultSchema';
import { SuccessTraceForm } from '../check-result-forms/SuccessTraceForm';
import { SuccessIOForm } from '../check-result-forms/SuccessIOForm';
import { CompileErrorForm } from '../check-result-forms/CompileErrorForm';
import { ParseErrorForm } from '../check-result-forms/ParseErrorForm';

export interface CheckResultFormViewProps {
  type: CheckResultType;
  schema: CheckResultSchema;
  onChange: (schema: CheckResultSchema) => void;
  disabled?: boolean;
}

/** スキーマ型に応じた専用フォームへ処理を振り分けるコンポーネント */
export const CheckResultFormView: React.FC<CheckResultFormViewProps> = ({
  type,
  schema,
  onChange,
  disabled,
}) => {
  switch (type) {
    case 'success_trace':
      return (
        <SuccessTraceForm
          schema={schema as SuccessTraceSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'success_io_single':
    case 'success_io_multi':
      return (
        <SuccessIOForm
          schema={schema as SuccessIOSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'compile_error':
      return (
        <CompileErrorForm
          schema={schema as CompileErrorSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'parse_error':
      return (
        <ParseErrorForm
          schema={schema as ParseErrorSchema}
          onChange={onChange}
          disabled={disabled}
        />
      );
    default:
      return <div>Unsupported schema type</div>;
  }
};
