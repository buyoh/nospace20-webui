// Environment configuration for flavor selection
// This file is separated to allow mocking in test environment

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

/** ブラウザ/Vite/Node 環境から環境変数を読み込む */
function readWebEnvVars(): ExpectedEnvVars {
  // Jest/Node 環境では process.env を使用
  if (typeof process !== 'undefined' && process.env?.VITE_APPLICATION_FLAVOR) {
    return { VITE_APPLICATION_FLAVOR: process.env.VITE_APPLICATION_FLAVOR };
  }

  // Vite/ブラウザ環境では import.meta.env を使用
  // new Function を使って動的に評価し、Jest でのパースエラーを回避
  try {
    const getImportMetaEnv = new Function('return import.meta.env');
    const env = getImportMetaEnv();
    return { VITE_APPLICATION_FLAVOR: env.VITE_APPLICATION_FLAVOR };
  } catch {
    return {};
  }
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
