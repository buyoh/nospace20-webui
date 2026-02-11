# hooks ユニットテスト設計

## 現状

`src/web/hooks/` 配下には以下の2つのカスタムフックがあるが、どちらもテストが存在しない。

- `useNospaceSocket` — Socket.IO 接続のライフサイクル管理とイベントハンドリング
- `useNospaceExecution` — 実行制御関数（run / kill / stdin / clear）を提供

既存のテスト (`src/tests/web/`) はコンポーネント単体テスト（`CodeTextarea`, `ExecutionControls`）のみで、hooks 層はカバーされていない。

## テスト方針

### 共通

- テストファイルの配置: `src/tests/web/useNospaceSocket.spec.ts`, `src/tests/web/useNospaceExecution.spec.ts`
- `@testing-library/react` の `renderHook` を使用
- Jotai の `Provider` でテスト用 store を注入
- `socket.io-client` をモジュールモックし、`EventEmitter` ベースの mock socket を提供
- テスト環境: jsdom（既存 jest.config.js の設定を踏襲）

### モック戦略

#### socket.io-client モック

`jest.mock('socket.io-client')` で `io` をモックし、`emit` / `on` / `close` を `jest.fn()` で定義した mock socket オブジェクトを返す。
イベント発火のシミュレーションには、`on` で登録されたコールバックを保存し、テストコードから直接呼び出すヘルパーを用意する。

```typescript
// テストユーティリティのイメージ
function createMockSocket() {
  const handlers: Record<string, Function[]> = {};
  return {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    emit: jest.fn(),
    close: jest.fn(),
    id: 'mock-socket-id',
    // テストヘルパー: イベントを発火
    _trigger(event: string, ...args: unknown[]) {
      (handlers[event] || []).forEach(h => h(...args));
    },
  };
}
```

#### useNospaceExecution のテストでの useNospaceSocket モック

`useNospaceExecution` は内部で `useNospaceSocket` を呼び出すため、`jest.mock('./useNospaceSocket')` で socket の戻り値を制御する。

---

## テストケース

### useNospaceSocket

| # | テストケース | 検証内容 |
|---|---|---|
| 1 | 初回レンダリングで socket が作成される | `createSocket` が呼ばれ、atom にセットされる |
| 2 | nospace_stdout イベントで outputEntries に追加 | `{ type: 'stdout', data }` のエントリが追加される |
| 3 | nospace_stderr イベントで outputEntries に追加 | `{ type: 'stderr', data }` のエントリが追加される |
| 4 | nospace_execution_status: running | `executionStatus` が `'running'` になり、system メッセージが追加される |
| 5 | nospace_execution_status: finished | `executionStatus` が `'finished'` になり、exitCode がセットされ、system メッセージが追加される |
| 6 | nospace_execution_status: killed | `executionStatus` が `'killed'` になり、system メッセージが追加される |
| 7 | nospace_execution_status: error | `executionStatus` が `'error'` になり、system メッセージが追加される |
| 8 | アンマウント時に socket.close() が呼ばれる | cleanup 関数で `close` が呼ばれる |

### useNospaceExecution

| # | テストケース | 検証内容 |
|---|---|---|
| 1 | isRunning: executionStatus が 'running' のとき true | `isRunning` の値が `true` |
| 2 | isRunning: executionStatus が 'idle' のとき false | `isRunning` の値が `false` |
| 3 | handleRun: socket 存在 & 非実行中で emit される | `socket.emit('nospace_run', ...)` が正しいペイロードで呼ばれる |
| 4 | handleRun: batch モードで stdinData が含まれる | ペイロードに `stdinData` が含まれる |
| 5 | handleRun: interactive モードで stdinData が undefined | ペイロードの `stdinData` が `undefined` |
| 6 | handleRun: 実行前に outputEntries がクリアされる | `setOutputEntries([])` が呼ばれる |
| 7 | handleRun: socket が null のとき emit されない | `emit` が呼ばれない |
| 8 | handleRun: 実行中のとき emit されない | `emit` が呼ばれない |
| 9 | handleKill: 正常系で emit される | `socket.emit('nospace_kill', { sessionId })` が呼ばれる |
| 10 | handleKill: socket null / sessionId null / 非実行中 で emit されない | `emit` が呼ばれない（3パターン） |
| 11 | handleSendStdin: 正常系で emit される | `socket.emit('nospace_stdin', { sessionId, data })` が呼ばれる |
| 12 | handleSendStdin: socket null / sessionId null / 非実行中 で emit されない | `emit` が呼ばれない |
| 13 | handleClearOutput: outputEntries が空になる | `setOutputEntries([])` が呼ばれる |

---

## 実装上の注意事項

### renderHook + Jotai Provider

`renderHook` に `wrapper` オプションで Jotai `Provider` を渡し、テストごとに独立した store を使う。
atom の初期値を制御するために、`Provider` の `initialValues` を活用するか、`renderHook` 後に atom を直接操作する。

```typescript
import { Provider, createStore } from 'jotai';

function createTestWrapper(initialValues?: Iterable<[any, any]>) {
  const store = createStore();
  if (initialValues) {
    for (const [atom, value] of initialValues) {
      store.set(atom, value);
    }
  }
  return {
    store,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  };
}
```

### act() の使用

socket イベントのシミュレーション時、状態更新を含むため `act()` でラップする必要がある。

### Date.now() のモック

`OutputEntry.timestamp` の検証が必要な場合は `jest.spyOn(Date, 'now')` でモックする。
ただし、timestamp の正確な値検証は脆いため、`expect.any(Number)` の使用を推奨。

## 優先度

`useNospaceExecution` のテストを先に実装するのが効率的。
理由: `useNospaceSocket` をモックすれば socket の詳細に依存せずテスト可能。
`useNospaceSocket` のテストは socket イベントのシミュレーション周りが complex なため後回しにしてよい。
