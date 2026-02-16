// Mock for env.ts in test environment
import type { Flavor } from '../../stores/flavorAtom';

export function getApplicationFlavor(): Flavor {
  return 'wasm';
}
