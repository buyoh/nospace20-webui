import { atom } from 'jotai';
import { getApplicationFlavor } from '../libs/env';

export type Flavor = 'wasm' | 'websocket';

/** Determine available flavors */
function getAvailableFlavors(): readonly Flavor[] {
  const flavor = getApplicationFlavor();
  if (flavor === 'websocket') {
    return ['wasm', 'websocket'];
  }
  return ['wasm'];
}

/** List of available flavors (computed on first access) */
export const availableFlavorsAtom = atom<readonly Flavor[]>((get) => {
  // Compute on first access to allow env setup in tests
  return getAvailableFlavors();
});

/**
 * Currently selected flavor.
 * Default is determined by VITE_APPLICATION_FLAVOR environment variable.
 * Falls back to 'wasm' if not set.
 */
export const flavorAtom = atom<Flavor>(getApplicationFlavor());
