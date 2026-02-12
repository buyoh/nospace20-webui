// Browser WASM loader for nospace20

import wasmUrl from './nospace20_bg.wasm?url';
import type {
  WasmWhitespaceVM as WasmWhitespaceVMType,
  compile as compileType,
  compile_to_mnemonic_string as compileToMnemonicType,
  compile_to_whitespace_string as compileToWsType,
  parse as parseType,
  run as runType,
} from './nospace20';

// Import browser-compatible version
import * as nospace20Module from './nospace20_browser.js';

/**
 * WASM module initialization state
 */
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize WASM module.
 * Call once at application startup.
 * Multiple calls are safe (subsequent calls return immediately).
 */
export async function initNospace20Wasm(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await nospace20Module.init(wasmUrl);
    initialized = true;
  })();

  return initPromise;
}

/**
 * Get nospace20 API (must call initNospace20Wasm first).
 * @throws {Error} if WASM is not initialized
 */
export function getNospace20(): {
  WasmWhitespaceVM: typeof WasmWhitespaceVMType;
  compile: typeof compileType;
  compile_to_mnemonic_string: typeof compileToMnemonicType;
  compile_to_whitespace_string: typeof compileToWsType;
  parse: typeof parseType;
  run: typeof runType;
} {
  if (!initialized) {
    throw new Error('WASM not initialized. Call initNospace20Wasm() first.');
  }
  return nospace20Module as any;
}

/**
 * Check if WASM is initialized.
 */
export function isNospace20WasmInitialized(): boolean {
  return initialized;
}
