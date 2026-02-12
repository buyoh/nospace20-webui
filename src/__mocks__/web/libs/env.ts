// Mock for Jest environment

let serverFlavorEnabled: boolean | null = null;

export function setServerFlavorEnabled(value: boolean): void {
  serverFlavorEnabled = value;
}

export function isServerFlavorEnabled(): boolean {
  if (serverFlavorEnabled !== null) return serverFlavorEnabled;
  // Default to false in test environment
  return false;
}
