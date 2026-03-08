/**
 * Node.js テスト環境向け nospace20 WASM ローダー
 *
 * bundler 形式の nospace20.js をバイパスし、Node.js の fs モジュールを使って
 * WASM バイナリを直接ロードする。Jest/Node.js テスト環境専用。
 *
 * 使い方:
 *   import { WasmNospaceVM, compile, ... } from './nospace20NodeLoader';
 *
 * 注意: このファイルはブラウザ環境・本番コードでは使用しないこと。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  WasmNospaceVM as WasmNospaceVMType,
  WasmWhitespaceVM as WasmWhitespaceVMType,
  compile as compileType,
  getOptions as getOptionsType,
  parse as parseType,
} from '../../../web/libs/nospace20/nospace20';

// nospace20_bg.js は ESM 形式だが, jest.config.js の transform 設定により
// ts-jest が CJS に変換する。require() で同期的に取得できる。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bgJs = require('../../../web/libs/nospace20/nospace20_bg.js') as Record<
  string,
  unknown
>;

// WASM バイナリを同期読み込みしてインスタンス化
const wasmPath = join(
  __dirname,
  '../../../web/libs/nospace20/nospace20_bg.wasm',
);
const wasmBytes = readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
// WASM が要求するインポートは './nospace20_bg.js' モジュールのエクスポート
const wasmInstance = new WebAssembly.Instance(wasmModule, {
  './nospace20_bg.js': bgJs,
});
// JS グルーコードに WASM エクスポートを注入して初期化完了
(bgJs.__wbg_set_wasm as (val: WebAssembly.Exports) => void)(
  wasmInstance.exports,
);

export const WasmNospaceVM = bgJs.WasmNospaceVM as typeof WasmNospaceVMType;
export const WasmWhitespaceVM =
  bgJs.WasmWhitespaceVM as typeof WasmWhitespaceVMType;
export const compile = bgJs.compile as typeof compileType;
export const getOptions = bgJs.getOptions as typeof getOptionsType;
export const parse = bgJs.parse as typeof parseType;
