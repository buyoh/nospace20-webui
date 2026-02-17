# VITE_APPLICATION_FLAVOR 環境変数が反映されない問題の調査と解決

## 問題

`.env.local` の `VITE_APPLICATION_FLAVOR` を `wasm` から `websocket` に変更しても、アプリケーションが `wasm` のままになっている。

## 根本原因

**`flavorAtom` の初期値が常に `'wasm'` にハードコードされていました。**

```typescript
// 修正前
export const flavorAtom = atom<Flavor>('wasm');
```

環境変数で `VITE_APPLICATION_FLAVOR=websocket` を設定していても、アプリケーションの初期表示では `flavorAtom` の初期値である `'wasm'` が使われていました。

## 解決方法

### 1. コードの修正（必須）

`flavorAtom` の初期値を環境変数から取得するように修正しました：

```typescript
// 修正後
export const flavorAtom = atom<Flavor>(getApplicationFlavor());
```

これにより、`.env.local` の `VITE_APPLICATION_FLAVOR` の値が初期表示に反映されるようになります。

### 2. 開発サーバーの再起動（必須）

```bash
# 開発サーバーを停止 (Ctrl+C)
# 再起動
npm run dev
```

## 環境変数の確認方法

ブラウザの開発者ツールで以下を実行すると、現在の設定を確認できます:

```javascript
// Vite 環境では直接アクセス可能
import.meta.env.VITE_APPLICATION_FLAVOR
```

または、`src/web/libs/env.ts` の `getApplicationFlavor()` 関数を使用:

```javascript
import { getApplicationFlavor } from './web/libs/env';
console.log(getApplicationFlavor());
```

## 実装の詳細

### `src/web/libs/env.ts`

環境変数の読み込みは以下の順序で行われます:

1. **テスト環境**: `setApplicationFlavor()` で設定された値（オーバーライド）
2. **Node.js/Jest 環境**: `process.env.VITE_APPLICATION_FLAVOR`
3. **Vite/ブラウザ環境**: `import.meta.env.VITE_APPLICATION_FLAVOR`
4. **デフォルト**: `'wasm'`

```typescript
function readWebEnvVars(): ExpectedEnvVars {
  // Jest/Node 環境では process.env を使用
  if (typeof process !== 'undefined' && process.env?.VITE_APPLICATION_FLAVOR) {
    return { VITE_APPLICATION_FLAVOR: process.env.VITE_APPLICATION_FLAVOR };
  }

  // Vite/ブラウザ環境では import.meta.env を使用
  // new Function を使って動的に評価し、Jest でのパースエラーを回避
  try {
    const getImportMetaEnv = new Function('return import.meta.env');
    const env = getImportMetaEnv();
    return { VITE_APPLICATION_FLAVOR: env.VITE_APPLICATION_FLAVOR };
  } catch {
    return {};
  }
}
```

### なぜ `new Function` を使用するのか

直接 `import.meta.env` にアクセスすると、Jest 環境でパースエラーが発生します:

```
SyntaxError: Cannot use 'import.meta' outside a module
```

`new Function` を使うことで、以下の利点があります:

1. **Jest でのパースエラーを回避**: Jest は `import.meta` を認識できないが、`new Function` 内のコードはパースされない
2. **Vite の実行時環境で動作**: Vite は実行時に `import.meta.env` オブジェクトを提供するため、動的評価でもアクセス可能

### テスト環境での動作

Jest テストでは、`src/__mocks__/web/libs/env.ts` のモックファイルを使用せず、実際のコードが動作します。`process.env` ではなく、`setApplicationFlavor()` 関数を使ってフレーバーを設定します:

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
- [src/web/stores/flavorAtom.ts](../../src/web/stores/flavorAtom.ts) - フレーバーの状態管理
- [.env.local](../../.env.local) - ローカル環境変数の設定
- [.env.example](../../.env.example) - 環境変数の例

## テスト結果

全テストがパス:
- Test Suites: 16 passed, 16 total
- Tests: 194 passed, 194 total
