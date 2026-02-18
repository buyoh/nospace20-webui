import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { flavorAtom, availableFlavorsAtom } from '../../stores/flavorAtom';
import type { Flavor } from '../../stores/flavorAtom';
import './styles/Header.scss';

/** アプリケーションヘッダー。タイトルと実行フレーバーの表示・切替を提供する。 */
export const Header: React.FC = () => {
  const [flavor, setFlavor] = useAtom(flavorAtom);
  const availableFlavors = useAtomValue(availableFlavorsAtom);
  const canSwitch = availableFlavors.length > 1;

  return (
    <header className="header">
      <h1><a href="https://github.com/buyoh/nospace20/">nospace Web IDE</a></h1>
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
