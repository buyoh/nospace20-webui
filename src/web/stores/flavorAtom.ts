import { atom } from 'jotai';
import { isServerFlavorEnabled } from '../libs/env';

export type Flavor = 'wasm' | 'server';

/** Determine available flavors */
function getAvailableFlavors(): readonly Flavor[] {
  if (isServerFlavorEnabled()) {
    return ['wasm', 'server'];
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
 * Default is 'wasm' (works everywhere without server).
 */
export const flavorAtom = atom<Flavor>('wasm');
