# ブラウザ向け WASM ローダー設計

## 課題

`src/web/libs/nospace20/nospace20.js` は wasm-bindgen が生成した JS バインディングだが、
末尾で Node.js の `require('fs').readFileSync` を使って WASM バイナリをロードしている。

```javascript
// nospace20.js 末尾（現状）
const wasmPath = `${__dirname}/nospace20_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
const wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;
wasm.__wbindgen_start();
```

ブラウザではこのコードは動作しない。

## 方針

`nospace20.js` を直接編集せず（wasm-bindgen 生成物のため）、ブラウザ向けのローダーモジュールを別途作成する。

## 設計

### `src/web/libs/nospace20/loader.ts`

ブラウザ環境で WASM をロードし、`nospace20.js` が内部で使う `wasm` 変数を初期化する仕組みを提供する。

```typescript
// src/web/libs/nospace20/loader.ts

import wasmUrl from './nospace20_bg.wasm?url';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * WASM モジュールを初期化する。
 * アプリケーション起動時に1回だけ呼び出す。
 * 複数回呼び出しても安全（2回目以降は即座に resolve）。
 */
export async function initWasm(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = doInit();
  await initPromise;
}

async function doInit(): Promise<void> {
  // WASM バイナリを fetch
  const response = await fetch(wasmUrl);
  const wasmBytes = await response.arrayBuffer();

  // nospace20.js の内部関数を利用して初期化
  // nospace20.js がエクスポートする __wbg_get_imports() と
  // wasm 変数のセットアップを再現
  const { __wbg_get_imports, __wbg_set_wasm, WasmWhitespaceVM, compile, ... } = await import('./nospace20_browser.js');

  const imports = __wbg_get_imports();
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(wasmModule, imports);
  __wbg_set_wasm(instance.exports);
  instance.exports.__wbindgen_start();

  initialized = true;
}
```

### アプローチ: `nospace20.js` の修正版を作成

wasm-bindgen 生成物を直接修正するのではなく、ブラウザ向けの薄いラッパーを作成する。

#### 方法A: `nospace20.js` をコピー＆修正

`nospace20.js` から WASM ロード部分を除去したブラウザ版（`nospace20_browser.js`）を作成し、
ローダーから初期化する。**wasm-bindgen の出力を更新するたびに再修正が必要** → 非推奨。

#### 方法B: nospace20.js の末尾ロード部分のみオーバーライド **（採用）**

`nospace20.js` の関数・クラス定義部分は Node.js 固有 API を使っていない。
問題は末尾の WASM ロードコードのみ。

ローダーモジュールで：
1. WASM バイナリを `fetch` でロード
2. `nospace20.js` 内部の `__wbg_get_imports()` を呼び出して imports オブジェクトを取得
3. `WebAssembly.instantiate` で WASM をインスタンス化
4. 生成された exports を `nospace20.js` 内部の `wasm` 変数にセット

このアプローチには `nospace20.js` が `wasm` 変数と `__wbg_get_imports` をモジュールスコープで
エクスポート可能にする必要がある。

**wasm-bindgen** の `--target web` オプションを使えば、ESM 形式で `init()` 関数をエクスポートする
ブラウザ向けバインディングを生成できる。WASM 提供元に `--target web` での再ビルドを依頼することが
最も保守性が高い。

#### 方法C: init 関数付きラッパー **（推奨・採用）**

`nospace20.js` を直接 import せず、ラッパーモジュールを作成して、以下の流れで初期化する：

1. WASM バイナリを `fetch` で取得
2. `nospace20.js` の内部構造（`__wbg_get_imports` 関数、各クラス・関数）をコピーした
   ブラウザ向けモジュールを用意（WASM ロード部分を `init()` 関数に置き換え）
3. `init()` を呼んで初期化完了後、各 API を利用可能にする

### 最終設計

`nospace20.js` は wasm-bindgen 生成の Node.js 向けモジュール。これを直接改変すると
更新時に差分管理が煩雑になる。

**実装方針**: `nospace20.js` の末尾（WASM ロード部分のみ  5行）を削除し、代わりに `init()` 関数を
エクスポートする形に最小限の修正を加える。修正箇所を明確にコメントで記録し、更新時の差分を最小化する。

```javascript
// nospace20.js 末尾を以下に置き換え:

// --- Browser-compatible WASM loading (modified from wasm-bindgen output) ---
let wasm;

/**
 * WASM モジュールを初期化する。
 * @param {WebAssembly.Module} module - コンパイル済み WASM モジュール
 */
function __wbg_init(module) {
    const instance = new WebAssembly.Instance(module, __wbg_get_imports());
    wasm = instance.exports;
    wasm.__wbindgen_start();
}
exports.__wbg_init = __wbg_init;
// --- End of browser-compatible modification ---
```

### `loader.ts` 最終設計

```typescript
// src/web/libs/nospace20/loader.ts

import type {
  WasmWhitespaceVM as WasmWhitespaceVMType,
  compile as compileType,
  compile_to_mnemonic_string as compileToMnemonicType,
  compile_to_whitespace_string as compileToWsType,
  parse as parseType,
  run as runType,
} from './nospace20';

/**
 * WASM モジュールの初期化状態
 */
type InitState =
  | { status: 'uninitialized' }
  | { status: 'loading'; promise: Promise<void> }
  | { status: 'ready' }
  | { status: 'error'; error: Error };

let state: InitState = { status: 'uninitialized' };

/**
 * nospace20 WASM を初期化する。
 * 複数回呼び出しても安全。
 */
export async function initNospace20Wasm(): Promise<void> {
  if (state.status === 'ready') return;
  if (state.status === 'loading') return state.promise;
  if (state.status === 'error') throw state.error;

  const promise = (async () => {
    try {
      // WASM バイナリを fetch
      const wasmUrl = new URL('./nospace20_bg.wasm', import.meta.url).href;
      const response = await fetch(wasmUrl);
      const wasmBytes = await response.arrayBuffer();
      const wasmModule = await WebAssembly.compile(wasmBytes);

      // nospace20.js をインポートし初期化
      const mod = await import('./nospace20.js');
      mod.__wbg_init(wasmModule);

      state = { status: 'ready' };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      state = { status: 'error', error };
      throw error;
    }
  })();

  state = { status: 'loading', promise };
  await promise;
}

/**
 * 初期化済みか確認
 */
export function isNospace20WasmReady(): boolean {
  return state.status === 'ready';
}

/**
 * nospace20 モジュールを取得（初期化済みであること）
 */
export async function getNospace20(): Promise<{
  WasmWhitespaceVM: typeof WasmWhitespaceVMType;
  compile: typeof compileType;
  compile_to_mnemonic_string: typeof compileToMnemonicType;
  compile_to_whitespace_string: typeof compileToWsType;
  parse: typeof parseType;
  run: typeof runType;
}> {
  await initNospace20Wasm();
  const mod = await import('./nospace20.js');
  return mod;
}
```

## Vite 設定

WASM ファイルを Vite のアセットとして扱うため、`vite.config.ts` に以下を追加：

```typescript
export default defineConfig({
  // ...
  assetsInclude: ['**/*.wasm'],
  // ...
});
```

または `import wasmUrl from './nospace20_bg.wasm?url'` の `?url` サフィックスを使用する
（Vite はデフォルトで `?url` をサポート）。

`import.meta.url` ベースの `new URL('./nospace20_bg.wasm', import.meta.url)` を使えば
Vite がビルド時に正しいパスに解決してくれる。

## `nospace20.js` への最小変更

現在の `nospace20.js` の末尾5行（Node.js WASM ロード）を、`__wbg_init` 関数に置き換える。
変更点：

1. `let wasm;` を変数宣言のみに（現状は即座にインスタンス化）
2. `__wbg_init(module)` 関数を追加
3. `__wbg_get_imports()` は既存のまま利用

この変更により `nospace20.js` は Node.js ではそのまま使えなくなるが、
サーバーサイドで WASM を直接使う予定はないため問題ない
（サーバー側は従来通り nospace20 バイナリを `child_process.spawn` で実行）。
