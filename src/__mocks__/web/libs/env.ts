// Mock for Jest environment

import type { Flavor } from '../../../web/stores/flavorAtom';

let applicationFlavorOverride: Flavor | null = null;

export function setApplicationFlavor(value: Flavor): void {
  applicationFlavorOverride = value;
}

export function getApplicationFlavor(): Flavor {
  if (applicationFlavorOverride !== null) return applicationFlavorOverride;
  // Default to 'wasm' in test environment
  return 'wasm';
}
