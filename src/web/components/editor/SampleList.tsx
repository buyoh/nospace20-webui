import React from 'react';
import type { EditorSample } from '../../libs/editorSamples';
import './styles/SampleList.scss';

/** SampleList の Props */
interface SampleListProps {
  /** 表示するサンプル一覧 */
  samples: EditorSample[];
  /** サンプルを選択してエディタへロードするコールバック */
  onLoad: (code: string) => void;
}

/**
 * サンプルプログラムの一覧を表示し、選択するとエディタへロードするコンポーネント。
 */
export const SampleList: React.FC<SampleListProps> = ({ samples, onLoad }) => {
  return (
    <div>
      <div className="sample-list">
        {samples.map((sample) => (
          <div key={sample.name} className="sample-list__item">
            <span className="sample-list__name">{sample.name}</span>
            <button
              className="sample-list__load-btn"
              onClick={() => onLoad(sample.code)}
            >
              Load
            </button>
          </div>
        ))}
        {samples.length === 0 && (
          <p className="sample-list__empty">サンプルはありません</p>
        )}
      </div>
      <div className="sample-list__footer">
        <a href="https://github.com/buyoh/nospace20/blob/master/docs/spec.md">
          Language Specification
        </a>
        {' '}/{' '}
        <a href="https://github.com/buyoh/nospace20/blob/master/docs/tutorial.md">
          Tutorial
        </a>
      </div>
    </div>
  );
};
