/// <reference types="vite/client" />
// Environment configuration for flavor selection
// Jest 環境では moduleNameMapper により __mocks__/web/libs/env.ts が使用される

import type { ExpectedEnvVars } from '../../interfaces/EnvConfig';
import type { Flavor } from '../stores/flavorAtom';

let applicationFlavorOverride: Flavor | null = null;

/**
 * テスト等でアプリケーション実行フレーバーを設定する
 * @param value 実行フレーバー
 */
export function setApplicationFlavor(value: Flavor): void {
  applicationFlavorOverride = value;
}

/**
 * Vite 環境から環境変数を読み込む。
 *
 * BUG FIX: 以前は new Function('return import.meta.env') を使用していたが、
 * import.meta は ES モジュールスコープでのみ有効であり、new Function で生成した
 * 関数はグローバルスコープで実行されるため、常に SyntaxError が発生していた。
 * その結果、catch ブロックで空オブジェクトが返され、デフォルト値 'wasm' が
 * 常に使用されていた。
 * 解決策: import.meta.env を直接参照する。Jest 環境ではこのファイル自体が
 * moduleNameMapper によりモックに差し替えられるため、パースエラーは発生しない。
 */
function readWebEnvVars(): ExpectedEnvVars {
  return {
    VITE_APPLICATION_FLAVOR: import.meta.env.VITE_APPLICATION_FLAVOR,
    VITE_NOSPACE_VERSION: import.meta.env.VITE_NOSPACE_VERSION,
    VITE_WEBUI_VERSION: import.meta.env.VITE_WEBUI_VERSION,
  };
}

/** 環境変数をパースしてアプリケーション実行フレーバーを返す */
export function parseApplicationFlavor(env: ExpectedEnvVars): Flavor {
  const value = env.VITE_APPLICATION_FLAVOR;
  if (value === 'websocket' || value === 'wasm') {
    return value;
  }
  return 'wasm';
}

/**
 * アプリケーション実行フレーバーを返す
 * @returns 現在の実行フレーバー
 */
export function getApplicationFlavor(): Flavor {
  if (applicationFlavorOverride !== null) return applicationFlavorOverride;
  return parseApplicationFlavor(readWebEnvVars());
}

/**
 * nospace コンパイラのバージョンを返す
 * @returns nospace のバージョン (semver) または undefined
 */
export function getNospaceVersion(): string | undefined {
  return readWebEnvVars().VITE_NOSPACE_VERSION;
}

/**
 * nospace-webui のバージョンを返す
 * @returns webui のバージョン (日付形式) または undefined
 */
export function getWebuiVersion(): string | undefined {
  return readWebEnvVars().VITE_WEBUI_VERSION;
}
