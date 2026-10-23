/**
 * WASM wrapper for Whitespace VM
 *
 * Treated as an opaque type on the JS side; manipulate state via method calls.
 */
export class WasmWhitespaceVM {
    static __wrap(ptr) {
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
     * Depth of call stack
     * @returns {number}
     */
    call_stack_depth() {
        const ret = wasm.wasmwhitespacevm_call_stack_depth(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Notify end of stdin stream (for interactive mode)
     *
     * After this, if an input instruction is reached with an empty buffer, it will be treated as EOF.
     */
    closeStdin() {
        wasm.wasmwhitespacevm_closeStdin(this.__wbg_ptr);
    }
    /**
     * Get mnemonic representation of current instruction (for debugging)
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
     * Get mnemonic representation of entire instruction sequence
     * @returns {string[]}
     */
    disassemble() {
        const ret = wasm.wasmwhitespacevm_disassemble(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * Get and clear stdout buffer contents
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
     * Construct VM directly from Whitespace source code
     *
     * The VM arguments are the same as the tail of `new`:
     * - `std_extensions`: `["debug"]` enables the debug extension of the VM.
     *   `"alloc"` is a compile-time extension and has no effect here (accepted so the same array as for `new` can be passed)
     * - `max_memory_cells`: same as `new` (`undefined` / `null` use `DEFAULT_MAX_MEMORY_CELLS_WASM` (4,194,304); only `0` means unlimited)
     * - `strict_heap` / `randomize_heap`: same as `new`
     * @param {string} ws_source
     * @param {string} stdin
     * @param {StdExtension[] | null} [std_extensions]
     * @param {number | null} [max_memory_cells]
     * @param {boolean | null} [strict_heap]
     * @param {boolean | null} [randomize_heap]
     * @returns {WasmWhitespaceVM}
     */
    static fromWhitespace(ws_source, stdin, std_extensions, max_memory_cells, strict_heap, randomize_heap) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(ws_source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmwhitespacevm_fromWhitespace(retptr, ptr0, len0, ptr1, len1, isLikeNone(std_extensions) ? 0 : addHeapObject(std_extensions), !isLikeNone(max_memory_cells), isLikeNone(max_memory_cells) ? 0 : max_memory_cells, isLikeNone(strict_heap) ? 0xFFFFFF : strict_heap ? 1 : 0, isLikeNone(randomize_heap) ? 0xFFFFFF : randomize_heap ? 1 : 0);
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
     * Construct VM from Whitespace source in interactive mode
     *
     * When stdin buffer is empty, suspends with WaitingForInput.
     * Can add data later with provide_stdin().
     * The VM arguments are the same as `fromWhitespace`.
     * @param {string} ws_source
     * @param {string} initial_stdin
     * @param {StdExtension[] | null} [std_extensions]
     * @param {number | null} [max_memory_cells]
     * @param {boolean | null} [strict_heap]
     * @param {boolean | null} [randomize_heap]
     * @returns {WasmWhitespaceVM}
     */
    static fromWhitespaceInteractive(ws_source, initial_stdin, std_extensions, max_memory_cells, strict_heap, randomize_heap) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(ws_source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(initial_stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmwhitespacevm_fromWhitespaceInteractive(retptr, ptr0, len0, ptr1, len1, isLikeNone(std_extensions) ? 0 : addHeapObject(std_extensions), !isLikeNone(max_memory_cells), isLikeNone(max_memory_cells) ? 0 : max_memory_cells, isLikeNone(strict_heap) ? 0xFFFFFF : strict_heap ? 1 : 0, isLikeNone(randomize_heap) ? 0xFFFFFF : randomize_heap ? 1 : 0);
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
     * Current contents of heap
     *
     * Returns: { [address: string]: number }
     * @returns {Record<string, number>}
     */
    get_heap() {
        const ret = wasm.wasmwhitespacevm_get_heap(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * Current contents of data stack
     *
     * Returns: number[] (i64 → JS number conversion. Precision drops for values > 53 bits)
     * @returns {number[]}
     */
    get_stack() {
        const ret = wasm.wasmwhitespacevm_get_stack(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * Get trace information
     *
     * Returns: { [key: string]: number }
     * @returns {any}
     */
    get_traced() {
        const ret = wasm.wasmwhitespacevm_get_traced(this.__wbg_ptr);
        return takeObject(ret);
    }
    /**
     * Whether execution is complete
     * @returns {boolean}
     */
    is_complete() {
        const ret = wasm.wasmwhitespacevm_is_complete(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Compile nospace source and construct Whitespace VM
     *
     * - `std_extensions`: Array of extensions to enable (e.g., `["debug", "alloc"]`)
     * - `opt_passes`: Array of optimization passes (e.g., `["all"]`)
     * - `max_memory_cells`: Memory limit of the VM in cells (heap addresses + data stack + return addresses).
     *   `undefined` / `null` use `DEFAULT_MAX_MEMORY_CELLS_WASM` (4,194,304); only `0` means unlimited.
     *   A value that is not a non-negative integer up to 4,294,967,295 is an error
     * - `strict_heap`: Reading an uninitialized heap address is a runtime error (default: false)
     * - `randomize_heap`: Reading an uninitialized heap address returns a deterministic non-zero value
     *   (default: false; `strict_heap` takes precedence when both are true)
     * @param {string} nospace_source
     * @param {string} stdin
     * @param {boolean | null} [interactive]
     * @param {StdExtension[] | null} [std_extensions]
     * @param {OptPass[] | null} [opt_passes]
     * @param {number | null} [max_memory_cells]
     * @param {boolean | null} [strict_heap]
     * @param {boolean | null} [randomize_heap]
     */
    constructor(nospace_source, stdin, interactive, std_extensions, opt_passes, max_memory_cells, strict_heap, randomize_heap) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(nospace_source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(stdin, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.wasmwhitespacevm_new(retptr, ptr0, len0, ptr1, len1, isLikeNone(interactive) ? 0xFFFFFF : interactive ? 1 : 0, isLikeNone(std_extensions) ? 0 : addHeapObject(std_extensions), isLikeNone(opt_passes) ? 0 : addHeapObject(opt_passes), !isLikeNone(max_memory_cells), isLikeNone(max_memory_cells) ? 0 : max_memory_cells, isLikeNone(strict_heap) ? 0xFFFFFF : strict_heap ? 1 : 0, isLikeNone(randomize_heap) ? 0xFFFFFF : randomize_heap ? 1 : 0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0;
            WasmWhitespaceVMFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Current program counter (instruction index)
     * @returns {number}
     */
    pc() {
        const ret = wasm.wasmwhitespacevm_pc(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Add data to stdin (for interactive mode)
     *
     * Call when in WaitingForInput state to retry input on next step().
     * For InputNumber, must provide with newline (\n).
     * @param {string} data
     */
    provideStdin(data) {
        const ptr0 = passStringToWasm0(data, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.wasmwhitespacevm_provideStdin(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * Execute specified number of steps
     *
     * Returns: { status: "suspended" | "complete" | "error" | "waiting_for_input", error?: string, inputType?: string }
     * @param {number} budget
     * @returns {VmStepResult}
     */
    step(budget) {
        const ret = wasm.wasmwhitespacevm_step(this.__wbg_ptr, budget);
        return takeObject(ret);
    }
    /**
     * Total number of instructions executed
     * @returns {number}
     */
    total_steps() {
        const ret = wasm.wasmwhitespacevm_total_steps(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) WasmWhitespaceVM.prototype[Symbol.dispose] = WasmWhitespaceVM.prototype.free;

/**
 * Compile nospace source code.
 * Equivalent to the CLI `nospace20`.
 *
 * - `std_extensions`: Array of extensions to enable (e.g., `["debug", "alloc"]`)
 * - `opt_passes`: Array of optimization passes to enable (e.g., `["all"]` or `["constant-folding", "dead-code"]`)
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
 * Return a list of available options
 *
 * Get option values that can be specified in compile() or WasmWhitespaceVM.
 * @returns {OptionsDefinition}
 */
export function getOptions() {
    const ret = wasm.getOptions();
    return takeObject(ret);
}

/**
 * Perform only syntax checking on nospace source code.
 * @param {string} source
 * @returns {ParseResult}
 */
export function parse(source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse(ptr0, len0);
    return takeObject(ret);
}
export function __wbg_Error_fdd633d4bb5dd76a(arg0, arg1) {
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
export function __wbg___wbindgen_boolean_get_edaed31a367ce1bd(arg0) {
    const v = getObject(arg0);
    const ret = typeof(v) === 'boolean' ? v : undefined;
    return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
}
export function __wbg___wbindgen_debug_string_8a447059637473e2(arg0, arg1) {
    const ret = debugString(getObject(arg1));
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_is_function_acc5528be2b923f2(arg0) {
    const ret = typeof(getObject(arg0)) === 'function';
    return ret;
}
export function __wbg___wbindgen_is_null_6d937fbfb6478470(arg0) {
    const ret = getObject(arg0) === null;
    return ret;
}
export function __wbg___wbindgen_is_object_0beba4a1980d3eea(arg0) {
    const val = getObject(arg0);
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
}
export function __wbg___wbindgen_is_string_1fca8072260dd261(arg0) {
    const ret = typeof(getObject(arg0)) === 'string';
    return ret;
}
export function __wbg___wbindgen_is_undefined_721f8decd50c87a3(arg0) {
    const ret = getObject(arg0) === undefined;
    return ret;
}
export function __wbg___wbindgen_jsval_loose_eq_4b9aba9e5b3c4582(arg0, arg1) {
    const ret = getObject(arg0) == getObject(arg1);
    return ret;
}
export function __wbg___wbindgen_number_get_1cc01dd708740256(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
}
export function __wbg___wbindgen_string_get_71bb4348194e31f0(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}
export function __wbg___wbindgen_throw_ea4887a5f8f9a9db(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
export function __wbg_call_8e98ed2f3c86c4b5() { return handleError(function (arg0, arg1) {
    const ret = getObject(arg0).call(getObject(arg1));
    return addHeapObject(ret);
}, arguments); }
export function __wbg_done_b62d4a7d2286852a(arg0) {
    const ret = getObject(arg0).done;
    return ret;
}
export function __wbg_get_9a29be2cb383ed9a() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(getObject(arg0), getObject(arg1));
    return addHeapObject(ret);
}, arguments); }
export function __wbg_get_unchecked_54a4374c38e08460(arg0, arg1) {
    const ret = getObject(arg0)[arg1 >>> 0];
    return addHeapObject(ret);
}
export function __wbg_instanceof_ArrayBuffer_2a7bb09fee70c2da(arg0) {
    let result;
    try {
        result = getObject(arg0) instanceof ArrayBuffer;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_instanceof_Uint8Array_f080092dc70f5d58(arg0) {
    let result;
    try {
        result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}
export function __wbg_isArray_145a34fd0a38d37b(arg0) {
    const ret = Array.isArray(getObject(arg0));
    return ret;
}
export function __wbg_iterator_cc47ba25a2be735a() {
    const ret = Symbol.iterator;
    return addHeapObject(ret);
}
export function __wbg_length_589238bdcf171f0e(arg0) {
    const ret = getObject(arg0).length;
    return ret;
}
export function __wbg_length_c6054974c0a6cdb9(arg0) {
    const ret = getObject(arg0).length;
    return ret;
}
export function __wbg_new_2e117a478906f062() {
    const ret = new Object();
    return addHeapObject(ret);
}
export function __wbg_new_3444eb7412549f0b() {
    const ret = new Map();
    return addHeapObject(ret);
}
export function __wbg_new_36e147a8ced3c6e0() {
    const ret = new Array();
    return addHeapObject(ret);
}
export function __wbg_new_81880fb5002cb255(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
}
export function __wbg_next_0c4066e251d2eff9() { return handleError(function (arg0) {
    const ret = getObject(arg0).next();
    return addHeapObject(ret);
}, arguments); }
export function __wbg_next_402fa10b59ab20c3(arg0) {
    const ret = getObject(arg0).next;
    return addHeapObject(ret);
}
export function __wbg_prototypesetcall_d721637c7ca66eb8(arg0, arg1, arg2) {
    Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
}
export function __wbg_set_4564f7dc44fcb0c9() { return handleError(function (arg0, arg1, arg2) {
    const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
    return ret;
}, arguments); }
export function __wbg_set_6be42768c690e380(arg0, arg1, arg2) {
    getObject(arg0)[takeObject(arg1)] = takeObject(arg2);
}
export function __wbg_set_9a1d61e17de7054c(arg0, arg1, arg2) {
    const ret = getObject(arg0).set(getObject(arg1), getObject(arg2));
    return addHeapObject(ret);
}
export function __wbg_set_dc601f4a69da0bc2(arg0, arg1, arg2) {
    getObject(arg0)[arg1 >>> 0] = takeObject(arg2);
}
export function __wbg_value_49f783bb59765962(arg0) {
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
const WasmWhitespaceVMFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmwhitespacevm_free(ptr, 1));

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
    return decodeText(ptr >>> 0, len);
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
