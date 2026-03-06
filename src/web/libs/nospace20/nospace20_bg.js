/**
 * NospaceVM の WASM ラッパー
 *
 * JS 側ではオペーク型として扱われ、メソッド呼び出しで状態を操作する。
 * `WasmWhitespaceVM` と同パターンのインターフェースを提供する。
 */
export class WasmNospaceVM {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmNospaceVMFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmnospacevm_free(ptr, 0);
    }
    /**
     * 標準出力バッファの内容を取得しクリアする
     * @returns {string}
     */
    flushStdout() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmnospacevm_flushStdout(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * 戻り値を取得（完了時のみ有効）
     * @returns {bigint | undefined}
     */
    getReturnValue() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmnospacevm_getReturnValue(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r2 = getDataViewMemory0().getBigInt64(retptr + 8 * 1, true);
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * トレース情報を取得
     *
     * 戻り値: { [key: string]: number }
     * @returns {any}
     */
    getTraced() {
        const ret = wasm.wasmnospacevm_getTraced(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * 実行完了済みか
     * @returns {boolean}
     */
    is_complete() {
        const ret = wasm.wasmnospacevm_is_complete(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * nospace ソースコードから VM を構築する
     *
     * - `stdin`: 標準入力の内容
     * - `opt_passes`: 最適化パスの配列（省略可; 例: `["all"]`）
     * - `ignore_debug`: デバッグ用組み込み関数を無視するか（省略可、デフォルト false）
     * @param {string} source
     * @param {string} stdin
     * @param {OptPass[] | null} [opt_passes]
     * @param {boolean | null} [ignore_debug]
     */
    constructor(source, stdin, opt_passes, ignore_debug) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmnospacevm_new(retptr, ptr0, len0, ptr1, len1, isLikeNone(opt_passes) ? 0 : addHeapObject(opt_passes), isLikeNone(ignore_debug) ? 0xFFFFFF : ignore_debug ? 1 : 0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            WasmNospaceVMFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * 指定ステップ数だけ実行する
     *
     * 戻り値: VmStepResult ({ status: "suspended" | "complete" | "error", error?: string })
     * @param {number} budget
     * @returns {VmStepResult}
     */
    step(budget) {
        const ret = wasm.wasmnospacevm_step(this.__wbg_ptr, budget);
        return takeObject(ret);
    }
    /**
     * 総式評価回数
     * @returns {number}
     */
    total_steps() {
        const ret = wasm.wasmnospacevm_total_steps(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WasmNospaceVM.prototype[Symbol.dispose] = WasmNospaceVM.prototype.free;

/**
 * Whitespace VM の WASM ラッパー
 *
 * JS 側ではオペーク型として扱われ、メソッド呼び出しで状態を操作する。
 */
export class WasmWhitespaceVM {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmWhitespaceVM.prototype);
        obj.__wbg_ptr = ptr;
        WasmWhitespaceVMFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmWhitespaceVMFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmwhitespacevm_free(ptr, 0);
    }
    /**
     * コールスタックの深さ
     * @returns {number}
     */
    call_stack_depth() {
        const ret = wasm.wasmwhitespacevm_call_stack_depth(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * stdin のストリーム終端を通知する（interactive モード用）
     *
     * 以降、バッファが空の状態で入力命令に到達すると EOF として処理される。
     */
    closeStdin() {
        wasm.wasmwhitespacevm_closeStdin(this.__wbg_ptr);
    }
    /**
     * 現在の命令のニーモニック表現を取得（デバッグ用）
     * @returns {string | undefined}
     */
    current_instruction() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmwhitespacevm_current_instruction(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1).slice();
                wasm.__wbindgen_export4(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * 命令列全体のニーモニック表現を取得
     * @returns {string[]}
     */
    disassemble() {
        const ret = wasm.wasmwhitespacevm_disassemble(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * 標準出力バッファの内容を取得しクリアする
     * @returns {string}
     */
    flush_stdout() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.wasmwhitespacevm_flush_stdout(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export4(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Whitespace ソースコードから直接 VM を構築する
     * @param {string} ws_source
     * @param {string} stdin
     * @returns {WasmWhitespaceVM}
     */
    static fromWhitespace(ws_source, stdin) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(ws_source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmwhitespacevm_fromWhitespace(retptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WasmWhitespaceVM.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Interactive モードで Whitespace ソースから VM を構築する
     *
     * stdin バッファが空の場合、WaitingForInput で一時停止する。
     * provide_stdin() で後からデータを追加可能。
     * @param {string} ws_source
     * @param {string} initial_stdin
     * @returns {WasmWhitespaceVM}
     */
    static fromWhitespaceInteractive(ws_source, initial_stdin) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(ws_source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(initial_stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmwhitespacevm_fromWhitespaceInteractive(retptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return WasmWhitespaceVM.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * ヒープの現在の内容
     *
     * 戻り値: { [address: string]: number }
     * @returns {Record<string, number>}
     */
    get_heap() {
        const ret = wasm.wasmwhitespacevm_get_heap(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * データスタックの現在の内容
     *
     * 戻り値: number[] (i64 → JS number に変換。53bit 超は精度が落ちる)
     * @returns {number[]}
     */
    get_stack() {
        const ret = wasm.wasmwhitespacevm_get_stack(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * トレース情報を取得
     *
     * 戻り値: { [key: string]: number }
     * @returns {any}
     */
    get_traced() {
        const ret = wasm.wasmwhitespacevm_get_traced(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * 実行完了済みか
     * @returns {boolean}
     */
    is_complete() {
        const ret = wasm.wasmwhitespacevm_is_complete(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * nospace ソースをコンパイルし、Whitespace VM を構築する
     *
     * - `std_extensions`: 有効にする拡張の配列（例: `["debug", "alloc"]`）
     * @param {string} nospace_source
     * @param {string} stdin
     * @param {boolean | null} [interactive]
     * @param {StdExtension[] | null} [std_extensions]
     */
    constructor(nospace_source, stdin, interactive, std_extensions) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(nospace_source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmwhitespacevm_new(retptr, ptr0, len0, ptr1, len1, isLikeNone(interactive) ? 0xFFFFFF : interactive ? 1 : 0, isLikeNone(std_extensions) ? 0 : addHeapObject(std_extensions));
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0 >>> 0;
            WasmWhitespaceVMFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * 現在のプログラムカウンタ（命令インデックス）
     * @returns {number}
     */
    pc() {
        const ret = wasm.wasmwhitespacevm_pc(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * stdin にデータを追加する（interactive モード用）
     *
     * WaitingForInput 状態の際に呼び出し、次の step() で入力を再試行する。
     * InputNumber の場合、改行（\n）付きで投入する必要がある。
     * @param {string} data
     */
    provideStdin(data) {
        const ptr0 = passStringToWasm0(data, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmwhitespacevm_provideStdin(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * 指定ステップ数だけ実行する
     *
     * 戻り値: { status: "suspended" | "complete" | "error" | "waiting_for_input", error?: string, inputType?: string }
     * @param {number} budget
     * @returns {VmStepResult}
     */
    step(budget) {
        const ret = wasm.wasmwhitespacevm_step(this.__wbg_ptr, budget);
        return takeObject(ret);
    }
    /**
     * 総実行命令数
     * @returns {number}
     */
    total_steps() {
        const ret = wasm.wasmwhitespacevm_total_steps(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WasmWhitespaceVM.prototype[Symbol.dispose] = WasmWhitespaceVM.prototype.free;

/**
 * nospace ソースコードをコンパイルする。
 * CLI の `--mode=compile` に相当。
 *
 * - `std_extensions`: 有効にする拡張の配列（例: `["debug", "alloc"]`）
 * - `opt_passes`: 有効にする最適化パスの配列（例: `["all"]` または `["constant-folding", "dead-code"]`）
 * @param {string} source
 * @param {string} target
 * @param {string} lang_std
 * @param {StdExtension[] | null} [std_extensions]
 * @param {OptPass[] | null} [opt_passes]
 * @returns {CompileResult}
 */
export function compile(source, target, lang_std, std_extensions, opt_passes) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(target, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(lang_std, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.compile(ptr0, len0, ptr1, len1, ptr2, len2, isLikeNone(std_extensions) ? 0 : addHeapObject(std_extensions), isLikeNone(opt_passes) ? 0 : addHeapObject(opt_passes));
    return takeObject(ret);
}

/**
 * 利用可能なオプションの一覧を返す
 *
 * compile() や WasmWhitespaceVM で指定可能なオプション値を取得できる。
 * @returns {OptionsDefinition}
 */
export function getOptions() {
    const ret = wasm.getOptions();
    return takeObject(ret);
}

/**
 * nospace ソースコードの構文チェックのみ行う。
 * @param {string} source
 * @returns {ParseResult}
 */
export function parse(source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse(ptr0, len0);
    return takeObject(ret);
}
export function __wbg_Error_83742b46f01ce22d(arg0, arg1) {
    const ret = Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
}
export function __wbg_String_8564e559799eccda(arg0, arg1) {
    const ret = String(getObject(arg1));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_boolean_get_c0f3f60bac5a78d1(arg0) {
    const v = getObject(arg0);
    const ret = typeof(v) === 'boolean' ? v : undefined;
    return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
}
export function __wbg___wbindgen_debug_string_5398f5bb970e0daa(arg0, arg1) {
    const ret = debugString(getObject(arg1));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_is_function_3c846841762788c1(arg0) {
    const ret = typeof(getObject(arg0)) === 'function';
    return ret;
}
export function __wbg___wbindgen_is_null_0b605fc6b167c56f(arg0) {
    const ret = getObject(arg0) === null;
    return ret;
}
export function __wbg___wbindgen_is_object_781bc9f159099513(arg0) {
    const val = getObject(arg0);
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
}
export function __wbg___wbindgen_is_string_7ef6b97b02428fae(arg0) {
    const ret = typeof(getObject(arg0)) === 'string';
    return ret;
}
export function __wbg___wbindgen_is_undefined_52709e72fb9f179c(arg0) {
    const ret = getObject(arg0) === undefined;
    return ret;
}
export function __wbg___wbindgen_jsval_loose_eq_5bcc3bed3c69e72b(arg0, arg1) {
    const ret = getObject(arg0) == getObject(arg1);
    return ret;
}
export function __wbg___wbindgen_number_get_34bb9d9dcfa21373(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
}
export function __wbg___wbindgen_string_get_395e606bd0ee4427(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_throw_6ddd609b62940d55(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_call_e133b57c9155d22c() { return handleError(function (arg0, arg1) {
    const ret = getObject(arg0).call(getObject(arg1));
    return addHeapObject(ret);
}, arguments); }
export function __wbg_done_08ce71ee07e3bd17(arg0) {
    const ret = getObject(arg0).done;
    return ret;
}
export function __wbg_get_326e41e095fb2575() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(getObject(arg0), getObject(arg1));
    return addHeapObject(ret);
}, arguments); }
export function __wbg_get_unchecked_329cfe50afab7352(arg0, arg1) {
    const ret = getObject(arg0)[arg1 >>> 0];
    return addHeapObject(ret);
}
export function __wbg_instanceof_ArrayBuffer_101e2bf31071a9f6(arg0) {
    let result;
    try {
        result = getObject(arg0) instanceof ArrayBuffer;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Uint8Array_740438561a5b956d(arg0) {
    let result;
    try {
        result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_isArray_33b91feb269ff46e(arg0) {
    const ret = Array.isArray(getObject(arg0));
    return ret;
}
export function __wbg_iterator_d8f549ec8fb061b1() {
    const ret = Symbol.iterator;
    return addHeapObject(ret);
}
export function __wbg_length_b3416cf66a5452c8(arg0) {
    const ret = getObject(arg0).length;
    return ret;
}
export function __wbg_length_ea16607d7b61445b(arg0) {
    const ret = getObject(arg0).length;
    return ret;
}
export function __wbg_new_49d5571bd3f0c4d4() {
    const ret = new Map();
    return addHeapObject(ret);
}
export function __wbg_new_5f486cdf45a04d78(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
}
export function __wbg_new_a70fbab9066b301f() {
    const ret = new Array();
    return addHeapObject(ret);
}
export function __wbg_new_ab79df5bd7c26067() {
    const ret = new Object();
    return addHeapObject(ret);
}
export function __wbg_next_11b99ee6237339e3() { return handleError(function (arg0) {
    const ret = getObject(arg0).next();
    return addHeapObject(ret);
}, arguments); }
export function __wbg_next_e01a967809d1aa68(arg0) {
    const ret = getObject(arg0).next;
    return addHeapObject(ret);
}
export function __wbg_prototypesetcall_d62e5099504357e6(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
}
export function __wbg_set_282384002438957f(arg0, arg1, arg2) {
    getObject(arg0)[arg1 >>> 0] = takeObject(arg2);
}
export function __wbg_set_6be42768c690e380(arg0, arg1, arg2) {
    getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
}
export function __wbg_set_7eaa4f96924fd6b3() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
    return ret;
}, arguments); }
export function __wbg_set_bf7251625df30a02(arg0, arg1, arg2) {
    const ret = getObject(arg0).set(getObject(arg1), getObject(arg2));
    return addHeapObject(ret);
}
export function __wbg_value_21fc78aab0322612(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
}
export function __wbindgen_cast_0000000000000001(arg0) {
    // Cast intrinsic for `F64 -> Externref`.
    const ret = arg0;
    return addHeapObject(ret);
}
export function __wbindgen_cast_0000000000000002(arg0, arg1) {
    // Cast intrinsic for `Ref(String) -> Externref`.
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
}
export function __wbindgen_cast_0000000000000003(arg0) {
    // Cast intrinsic for `U64 -> Externref`.
    const ret = BigInt.asUintN(64, arg0);
    return addHeapObject(ret);
}
export function __wbindgen_object_clone_ref(arg0) {
    const ret = getObject(arg0);
    return addHeapObject(ret);
}
export function __wbindgen_object_drop_ref(arg0) {
    takeObject(arg0);
}
const WasmNospaceVMFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmnospacevm_free(ptr >>> 0, 1));
const WasmWhitespaceVMFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmwhitespacevm_free(ptr >>> 0, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export3(addHeapObject(e));
    }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;


let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}
