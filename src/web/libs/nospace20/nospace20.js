/* @ts-self-types="./nospace20.d.ts" */

import * as wasm from "./nospace20_bg.wasm";
import { __wbg_set_wasm } from "./nospace20_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    WasmWhitespaceVM, compile, compile_to_mnemonic_string, compile_to_whitespace_string, parse, run
} from "./nospace20_bg.js";
