# VITE_APPLICATION_FLAVOR 環境変数が反映されない問題の調査と解決

## 問題

`.env.local` の `VITE_APPLICATION_FLAVOR` を `wasm` から `websocket` に変更しても、アプリケーションが `wasm` のままになっている。

## 根本原因

**`readWebEnvVars()` が `new Function('return import.meta.env')` を使用していたが、`import.meta` は ES モジュールスコープでのみ有効であり、`new Function` で生成した関数はグローバルスコープで実行されるため、常に SyntaxError が発生していた。**

```typescript
// 修正前 - 常に SyntaxError が発生し、catch ブロックで {} が返される
function readWebEnvVars(): ExpectedEnvVars {
  // ...
  try {
    const getImportMetaEnv = new Function('return import.meta.env');
    const env = getImportMetaEnv(); // ← SyntaxError: import.meta is only valid in module scope
    return { VITE_APPLICATION_FLAVOR: env.VITE_APPLICATION_FLAVOR };
  } catch {
    return {}; // ← 常にここに到達
  }
}
```

`parseApplicationFlavor({})` がデフォルト値 `'wasm'` を返すため、環境変数の設定に関わらず常に `wasm` になっていた。

## 解決方法

### 1. `env.ts` で `import.meta.env` を直接参照

`new Function` を経由せず、`import.meta.env` を直接使用するように修正：

```typescript
// 修正後
function readWebEnvVars(): ExpectedEnvVars {
  return { VITE_APPLICATION_FLAVOR: import.meta.env.VITE_APPLICATION_FLAVOR };
}
```

### 2. Jest の `moduleNameMapper` でモックに差し替え

`import.meta.env` は CommonJS (Jest) ではパース不可のため、`jest.config.js` に `moduleNameMapper` を追加し、テスト時はモックファイルを使用：

```javascript
// jest.config.js
moduleNameMapper: {
  '(.*/|\\.\\./)libs/env$': '<rootDir>/src/__mocks__/web/libs/env.ts'
}
```

### 3. 開発サーバーの再起動（必須）

```bash
# 開発サーバーを停止 (Ctrl+C)
# 再起動
npm run dev
```

## 実装の詳細

### `src/web/libs/env.ts`

Vite 環境では `import.meta.env` を直接参照する。Jest 環境ではこのファイル自体が `moduleNameMapper` によりモックに差し替えられる。

### `src/__mocks__/web/libs/env.ts`

Jest 用モック。`setApplicationFlavor()` によるオーバーライドをサポートし、デフォルトは `'wasm'`。

### テスト環境での動作

```typescript
import { setApplicationFlavor } from '../../web/libs/env';

// テスト前にフレーバーを設定
setApplicationFlavor('websocket');

// テスト後にリセット
setApplicationFlavor('wasm');
```

## 注意事項

- `.env.local` の変更後は、必ず開発サーバーを再起動してください
- ブラウザのキャッシュが残っている場合は、ハードリロード (Cmd+Shift+R / Ctrl+Shift+R) を実行してください
- 本番ビルド時は `npm run build` を実行することで、最新の環境変数が埋め込まれます

## 関連ファイル

- [src/web/libs/env.ts](../../src/web/libs/env.ts) - 環境変数の読み込みロジック
- [src/__mocks__/web/libs/env.ts](../../src/__mocks__/web/libs/env.ts) - Jest 用モック
- [src/web/stores/flavorAtom.ts](../../src/web/stores/flavorAtom.ts) - フレーバーの状態管理
- [jest.config.js](../../jest.config.js) - Jest 設定
- [.env.local](../../.env.local) - ローカル環境変数の設定

## テスト結果

全テストがパス:
- Test Suites: 16 passed, 16 total
- Tests: 194 passed, 194 total
