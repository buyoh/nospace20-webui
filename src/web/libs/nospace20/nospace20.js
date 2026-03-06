/* @ts-self-types="./nospace20.d.ts" */

import * as wasm from "./nospace20_bg.wasm";
import { __wbg_set_wasm } from "./nospace20_bg.js";
__wbg_set_wasm(wasm);

export {
    WasmNospaceVM, WasmWhitespaceVM, compile, getOptions, parse
} from "./nospace20_bg.js";
