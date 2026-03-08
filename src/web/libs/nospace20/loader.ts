// Browser WASM loader for nospace20
//
// bundler 形式の nospace20.js を動的 import し、WASM の遅延ロードを提供する。

import type {
  WasmNospaceVM as WasmNospaceVMType,
  WasmWhitespaceVM as WasmWhitespaceVMType,
  compile as compileType,
  getOptions as getOptionsType,
  parse as parseType,
} from './nospace20';

type Nospace20Module = {
  WasmNospaceVM: typeof WasmNospaceVMType;
  WasmWhitespaceVM: typeof WasmWhitespaceVMType;
  compile: typeof compileType;
  getOptions: typeof getOptionsType;
  parse: typeof parseType;
};

/**
 * WASM module initialization state
 */
let nospace20Module: Nospace20Module | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize WASM module.
 * Call once at application startup.
 * Multiple calls are safe (subsequent calls return immediately).
 */
export async function initNospace20Wasm(): Promise<void> {
  if (nospace20Module) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // bundler 形式では import 時に wasm のロード・初期化が自動的に行われる
    const mod = await import('./nospace20.js');
    nospace20Module = mod as Nospace20Module;
  })();

  return initPromise;
}

/**
 * Get nospace20 API (must call initNospace20Wasm first).
 * @throws {Error} if WASM is not initialized
 */
export function getNospace20(): Nospace20Module {
  if (!nospace20Module) {
    throw new Error('WASM not initialized. Call initNospace20Wasm() first.');
  }
  return nospace20Module;
}

/**
 * Check if WASM is initialized.
 */
export function isNospace20WasmInitialized(): boolean {
  return nospace20Module !== null;
}
