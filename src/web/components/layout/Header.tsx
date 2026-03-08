import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { flavorAtom, availableFlavorsAtom } from '../../stores/flavorAtom';
import type { Flavor } from '../../stores/flavorAtom';
import { getNospaceVersion, getWebuiVersion } from '../../libs/env';
import './styles/Header.scss';

/** アプリケーションヘッダー。タイトル、バージョン情報、実行フレーバーの表示・切替を提供する。 */
export const Header: React.FC = () => {
  const [flavor, setFlavor] = useAtom(flavorAtom);
  const availableFlavors = useAtomValue(availableFlavorsAtom);
  const canSwitch = availableFlavors.length > 1;

  const nospaceVersion = getNospaceVersion();
  const webuiVersion = getWebuiVersion();

  return (
    <header className="header">
      <div className="header-title">
        <h1>
          <a href="https://github.com/buyoh/nospace20/">nospace Web IDE</a>
        </h1>
        <div className="header-versions">
          {nospaceVersion && (
            <span className="version-badge" data-testid="nospace-version">
              nospace v{nospaceVersion}
            </span>
          )}
          {webuiVersion && (
            <span className="version-badge" data-testid="webui-version">
              webui {webuiVersion}
            </span>
          )}
        </div>
      </div>
      <div className="header-flavor">
        {canSwitch ? (
          <select
            className="header-flavor-select"
            value={flavor}
            onChange={(e) => setFlavor(e.target.value as Flavor)}
            aria-label="Execution flavor"
          >
            {availableFlavors.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        ) : (
          <span className="header-flavor-badge" data-testid="flavor-badge">
            {flavor.toUpperCase()}
          </span>
        )}
      </div>
    </header>
  );
};
