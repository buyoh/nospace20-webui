import { atom } from 'jotai';
import { isServerFlavorEnabled } from '../libs/env';

export type Flavor = 'wasm' | 'server';

/** Determine available flavors at build time */
function getAvailableFlavors(): readonly Flavor[] {
  if (isServerFlavorEnabled()) {
    return ['wasm', 'server'];
  }
  return ['wasm'];
}

const AVAILABLE_FLAVORS: readonly Flavor[] = getAvailableFlavors();

/** List of available flavors */
export const availableFlavorsAtom = atom<readonly Flavor[]>(AVAILABLE_FLAVORS);

/**
 * Currently selected flavor.
 * Default is 'wasm' (works everywhere without server).
 */
export const flavorAtom = atom<Flavor>('wasm');
