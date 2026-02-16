// Environment configuration for flavor selection
// This file is separated to allow mocking in test environment

import type { ExpectedEnvVars } from '../../interfaces/EnvConfig';

let serverFlavorEnabled: boolean | null = null;

/**
 * テスト等で Server Flavor の有効状態を設定する
 * @param value 有効状態
 */
export function setServerFlavorEnabled(value: boolean): void {
  serverFlavorEnabled = value;
}

/** ブラウザ/Vite/Node 環境から環境変数を読み込む */
function readWebEnvVars(): ExpectedEnvVars {
  // Jest/Node 環境では process.env を使用
  if (typeof process !== 'undefined' && process.env?.VITE_ENABLE_SERVER) {
    return { VITE_ENABLE_SERVER: process.env.VITE_ENABLE_SERVER };
  }

  // Vite/ブラウザ環境では import.meta.env を使用
  // new Function を使って動的に評価し、Jest でのパースエラーを回避
  try {
    const getImportMetaEnv = new Function('return import.meta.env');
    const env = getImportMetaEnv();
    return { VITE_ENABLE_SERVER: env.VITE_ENABLE_SERVER };
  } catch {
    return {};
  }
}

/** 環境変数をパースして Server Flavor の有効状態を返す */
export function parseEnableServer(env: ExpectedEnvVars): boolean {
  return env.VITE_ENABLE_SERVER === 'true';
}

/**
 * Server Flavor が有効かどうかを返す
 * @returns Server Flavor が有効な場合 true
 */
export function isServerFlavorEnabled(): boolean {
  if (serverFlavorEnabled !== null) return serverFlavorEnabled;
  return parseEnableServer(readWebEnvVars());
}
