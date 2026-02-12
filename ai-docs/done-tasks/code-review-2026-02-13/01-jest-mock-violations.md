# 問題 1: jest.mock によるモジュール差し替えの使用

## 違反ルール

> Mock ライブラリ等によるメソッドの差し替えは禁止。依存性注入やテンプレートを使用する

## 現状

以下のテストファイルで `jest.mock()` を使用してモジュール全体を差し替えている。

### 1-A: `src/tests/web/ServerExecutionBackend.spec.ts`

```typescript
jest.mock('socket.io-client');
```

`ServerExecutionBackend` クラスが `init()` 内で `io()` を直接呼び出しており、テストでモジュール差し替えが必要になっている。

### 1-B: `src/tests/web/useNospaceSocket.spec.tsx`

```typescript
jest.mock('socket.io-client', () => {
  return { io: jest.fn() };
});
```

`useNospaceSocket` フックが `createSocket()` を呼び、`createSocket` 内で `io()` を直接呼び出しているため。

### 1-C: `src/tests/web/useNospaceExecution.spec.tsx`

```typescript
jest.mock('../../web/hooks/useNospaceSocket');
```

※ これは問題 3（デッドコード）とも関連。実装が `ExecutionBackend` に移行済みのため、テスト自体が旧 API をテストしている。

### 1-D: `src/tests/setupTests.ts`

```typescript
jest.mock('../web/libs/env');
```

`env.ts` が `import.meta.env` を使用しており、Jest 環境では利用不可のため差し替えている。

## 修正方針

### 1-A: `ServerExecutionBackend` に socket factory の DI を導入

**変更対象**: `src/web/services/ServerExecutionBackend.ts`

```typescript
// Before
async init(): Promise<void> {
  this.socket = io();
  ...
}

// After - コンストラクタでソケットファクトリを注入
export interface SocketFactory {
  (): AppSocket;
}

const defaultSocketFactory: SocketFactory = () => io();

export class ServerExecutionBackend implements ExecutionBackend {
  constructor(private socketFactory: SocketFactory = defaultSocketFactory) {}

  async init(): Promise<void> {
    this.socket = this.socketFactory();
    ...
  }
}
```

**テスト**: ファクトリ関数を注入し、fake socket を返す。

```typescript
// ServerExecutionBackend.spec.ts
const fakeSocket = createFakeSocket();
const backend = new ServerExecutionBackend(() => fakeSocket);
```

### 1-B: `useNospaceSocket` / `socketAtom` のデッドコード削除

問題 3 で対応。削除後、テストも不要になる。

### 1-C: `useNospaceExecution.spec.tsx` のリファクタリング

`useNospaceExecution` フックは `ExecutionBackend` を動的インポートで生成している。テストでは以下のアプローチでモック不要にする:

- `useNospaceExecution` のバックエンド生成ロジックにファクトリ関数を導入し、テスト時に fake backend を注入可能にする
- または、hook のテスト対象を backend factory と hook に分離し、hook のテストでは backend のフェイクを DI で提供する

### 1-D: `env.ts` の DI 対応

**変更対象**: `src/web/libs/env.ts`, `src/web/stores/flavorAtom.ts`

```typescript
// env.ts - DI 可能にする
let serverFlavorEnabled: boolean | null = null;

export function setServerFlavorEnabled(value: boolean): void {
  serverFlavorEnabled = value;
}

export function isServerFlavorEnabled(): boolean {
  if (serverFlavorEnabled !== null) return serverFlavorEnabled;
  // @ts-expect-error
  return import.meta.env.VITE_ENABLE_SERVER === 'true';
}
```

または、`flavorAtom.ts` が引数で受け取る設計にする:

```typescript
// flavorAtom.ts
function getAvailableFlavors(isServerEnabled: boolean): readonly Flavor[] {
  if (isServerEnabled) return ['wasm', 'server'];
  return ['wasm'];
}
```

テストでは `setServerFlavorEnabled(false)` を呼ぶか、引数を直接渡す。

## 影響範囲

- `src/web/services/ServerExecutionBackend.ts` : socket factory DI 導入
- `src/tests/web/ServerExecutionBackend.spec.ts` : jest.mock 除去、DI に変更
- `src/web/hooks/useNospaceExecution.ts` : backend factory の DI 化
- `src/tests/web/useNospaceExecution.spec.tsx` : jest.mock 除去、全面書き換え
- `src/web/libs/env.ts` : DI 対応
- `src/web/stores/flavorAtom.ts` : DI 対応
- `src/tests/setupTests.ts` : jest.mock 除去
