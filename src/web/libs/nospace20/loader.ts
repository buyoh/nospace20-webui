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

/** nospace20 WASM モジュールの公開 API */
export type Nospace20Module = {
  WasmNospaceVM: typeof WasmNospaceVMType;
  WasmWhitespaceVM: typeof WasmWhitespaceVMType;
  compile: typeof compileType;
  getOptions: typeof getOptionsType;
  parse: typeof parseType;
};

/** WASM モジュールの遅延ロードと初期化状態を管理するローダー */
export interface Nospace20ModuleLoader {
  /** 初期化する。複数回呼んでも安全。失敗後に再度呼ぶと再試行する */
  init(): Promise<void>;
  /** @throws {Error} 初期化前に呼んだ場合 */
  get(): Nospace20Module;
  isInitialized(): boolean;
}

/**
 * ローダーを生成する。import 関数を注入できるため、テストで実際の WASM に依存せずに検証できる。
 *
 * BUG FIX: 以前は失敗（chunk の取得失敗や wasm の取得失敗）で reject された initPromise を
 * キャッシュし続けていたため、flavor を切り替えても再試行されず、リロードするまで復旧しなかった。
 * 解決策として、失敗時に initPromise を破棄して次回の呼び出しで再試行できるようにする。
 */
export function createNospace20Loader(
  importFn: () => Promise<Nospace20Module>
): Nospace20ModuleLoader {
  let nospace20Module: Nospace20Module | null = null;
  let initPromise: Promise<void> | null = null;

  return {
    async init(): Promise<void> {
      if (nospace20Module) return;
      if (initPromise) return initPromise;

      initPromise = importFn()
        .then((mod) => {
          nospace20Module = mod;
        })
        .catch((err) => {
          initPromise = null;
          throw err;
        });
      return initPromise;
    },
    get(): Nospace20Module {
      if (!nospace20Module) {
        throw new Error(
          'WASM not initialized. Call initNospace20Wasm() first.'
        );
      }
      return nospace20Module;
    },
    isInitialized(): boolean {
      return nospace20Module !== null;
    },
  };
}

// bundler 形式では import 時に wasm のロード・初期化が自動的に行われる
const defaultLoader = createNospace20Loader(
  () => import('./nospace20.js') as Promise<Nospace20Module>
);

/**
 * Initialize WASM module.
 * Call once at application startup.
 * Multiple calls are safe (subsequent calls return immediately).
 */
export async function initNospace20Wasm(): Promise<void> {
  return defaultLoader.init();
}

/**
 * Get nospace20 API (must call initNospace20Wasm first).
 * @throws {Error} if WASM is not initialized
 */
export function getNospace20(): Nospace20Module {
  return defaultLoader.get();
}

/**
 * Check if WASM is initialized.
 */
export function isNospace20WasmInitialized(): boolean {
  return defaultLoader.isInitialized();
}
