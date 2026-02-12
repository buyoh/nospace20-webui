// Environment configuration for flavor selection
// This file is separated to allow mocking in test environment

export function isServerFlavorEnabled(): boolean {
  // @ts-expect-error - import.meta.env is available in Vite but not in TS type checking
  return import.meta.env.VITE_ENABLE_SERVER === 'true';
}
