// Environment configuration for flavor selection
// This file is separated to allow mocking in test environment

let serverFlavorEnabled: boolean | null = null;

/**
 * テスト等で Server Flavor の有効状態を設定する
 * @param value 有効状態
 */
export function setServerFlavorEnabled(value: boolean): void {
  serverFlavorEnabled = value;
}

/**
 * Server Flavor が有効かどうかを返す
 * @returns Server Flavor が有効な場合 true
 */
export function isServerFlavorEnabled(): boolean {
  if (serverFlavorEnabled !== null) return serverFlavorEnabled;

  // Jest/Node 環境では process.env を使用
  if (typeof process !== 'undefined' && process.env?.VITE_ENABLE_SERVER) {
    return process.env.VITE_ENABLE_SERVER === 'true';
  }

  // Vite/ブラウザ環境では import.meta.env を使用
  // new Function を使って動的に評価し、Jest でのパースエラーを回避
  try {
    const getImportMetaEnv = new Function('return import.meta.env');
    const env = getImportMetaEnv();
    return env.VITE_ENABLE_SERVER === 'true';
  } catch {
    return false;
  }
}
