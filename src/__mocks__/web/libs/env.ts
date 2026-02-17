// Mock for Jest environment

import type { Flavor } from '../../../web/stores/flavorAtom';
import type { ExpectedEnvVars } from '../../../interfaces/EnvConfig';

let applicationFlavorOverride: Flavor | null = null;

export function setApplicationFlavor(value: Flavor): void {
  applicationFlavorOverride = value;
}

export function parseApplicationFlavor(env: ExpectedEnvVars): Flavor {
  const value = env.VITE_APPLICATION_FLAVOR;
  if (value === 'websocket' || value === 'wasm') {
    return value;
  }
  return 'wasm';
}

export function getApplicationFlavor(): Flavor {
  if (applicationFlavorOverride !== null) return applicationFlavorOverride;
  // Default to 'wasm' in test environment
  return 'wasm';
}
