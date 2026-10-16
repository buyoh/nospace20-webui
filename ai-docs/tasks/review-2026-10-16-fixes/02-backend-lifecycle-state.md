# 02. 実行バックエンドのライフサイクル管理と状態表示

flavor 切替時の初期化競合を解消し、初期化中・失敗・切断の状態を UI に表示して再試行可能にする。

作成日: 2026-10-16
ステータス: 設計完了（未実装）
元指摘: [06-backend-init-race-and-failure.md](../code-review-2026-10-16/06-backend-init-race-and-failure.md)

## 設計・方針

### 現状の問題（要約）

- `useExecutionBackend` の effect は `await backend.init()` 後に `cancelled` を確認せず、`backendRef.current?.dispose(); backendRef.current = backend;` を実行する。遅い init（websocket）が後から完了すると、選択中の flavor と異なる backend が採用される
- cleanup は `backendRef.current`（他の effect が設定したものかもしれない）を dispose する
- factory（動的 import）の reject が未処理。init 失敗時も backend を採用し、`handleRun` は `console.warn` だけで黙って何もしない
- `loader.ts` は reject 済みの `initPromise` をキャッシュし、再試行できない
- dispose 済み backend のコールバック（WASM の abort 時 `killed` 等）が atom に書き込まれうる
- flavor 切替時、旧 backend で `running` だった `executionStatusAtom` が残り、操作不能になりうる

### `useExecutionBackend` の再設計

```ts
useEffect(() => {
  let cancelled = false;
  let disposed = false;                          // この effect の backend を dispose 済みか
  let backend: ExecutionBackend | null = null;   // この effect が所有する backend

  // flavor 切替時に実行状態・コンパイル追跡状態をリセット
  setExecutionStatus('idle');
  setCurrentSessionId(null);
  setCompileStatus(null);
  compileTargetRef.current = null;
  compileHadErrorRef.current = false;
  prevStatusRef.current = null;
  setBackendState({ kind: 'initializing' });

  (async () => {
    try {
      const created = await backendFactory(flavor);
      if (cancelled) { created.dispose(); return; }
      backend = created;

      // 各コールバック先頭で (cancelled || disposed) なら return
      wireCallbacks(backend, () => cancelled || disposed);

      await backend.init();
      if (cancelled) return;                      // dispose は cleanup が行う

      backendRef.current = backend;
      setBackendState({ kind: 'ready' });
    } catch (err) {
      if (cancelled) return;
      disposed = true;
      backend?.dispose();
      backend = null;
      setBackendState({ kind: 'error', message: toMessage(err) });
    }
  })();

  return () => {
    cancelled = true;
    if (backend) {
      if (backendRef.current === backend) backendRef.current = null;
      backend.dispose();
    }
  };
}, [flavor, backendFactory, retryToken, /* setters */]);
```

要点:

| 変更 | 目的 |
|---|---|
| backend をローカル変数で所有し、cleanup はそれのみ dispose | 他の effect の backend を誤って破棄しない |
| 各 await 後に `cancelled` を確認 | 古い init の完了で backendRef を上書きしない |
| コールバックを `cancelled \|\| disposed` でガード | dispose 済み backend（flavor 切替・init 失敗の両方）のイベントを atom に反映しない |
| init 失敗時は backend を採用しない | 「準備できていない backend」を使わない |
| IIFE 全体を try/catch | factory の reject を unhandled にしない |
| 開始時に `executionStatus` を `idle`、`compileStatus` を null、compile 系 ref を初期化 | 旧 backend の `running` が残らない。`prevStatusRef === 'compiling'` の残留で次の Run 時に誤って「✓ OK」が出るのを防ぐ |

`ExecutionContainer` の `pendingAutoRunRef`（Compile/Run の自動実行待ち）も flavor 変更時に null に戻す（`useEffect(() => { pendingAutoRunRef.current = null; }, [flavor])`）。

### 状態と再試行

- `backendStateAtom`（README 共通設計 B）を `src/web/stores/executionAtom.ts` に追加
- 再試行: `useExecutionBackend` 内に `const [retryToken, setRetryToken] = useState(0)` を持ち、`retry = () => setRetryToken(n => n + 1)` を返す。effect deps に `retryToken` を含めることで再生成・再初期化する
- 返り値に `retry` を追加。`useNospaceExecution` は `backendState` と `retryBackend` を返す
- `handleRun` / `handleCompile` / `handleRunCompileOutput` のガードは `backendState.kind !== 'ready'` を条件に加える（`console.warn` は残してよい）

### loader の再試行対応（`src/web/libs/nospace20/loader.ts`）

import 関数を DI できるようにファクトリに分離し、既存の関数はデフォルトインスタンスに委譲する（テストで `jest.mock` を使わずに再試行を検証するため）。

```ts
/** WASM モジュールの遅延ロードと初期化状態を管理するローダー */
export function createNospace20Loader(importFn: () => Promise<Nospace20Module>) {
  let mod: Nospace20Module | null = null;
  let initPromise: Promise<void> | null = null;
  return {
    async init(): Promise<void> {
      if (mod) return;
      if (initPromise) return initPromise;
      initPromise = importFn().then((m) => { mod = m; }).catch((err) => {
        initPromise = null;   // 失敗時は次回呼び出しで再試行できるようにする
        throw err;
      });
      return initPromise;
    },
    get(): Nospace20Module { /* 未初期化なら throw */ },
    isInitialized(): boolean { return mod !== null; },
  };
}
const defaultLoader = createNospace20Loader(() => import('./nospace20.js') as Promise<Nospace20Module>);
export const initNospace20Wasm = () => defaultLoader.init();
export const getNospace20 = () => defaultLoader.get();
export const isNospace20WasmInitialized = () => defaultLoader.isInitialized();
```

### UI

- 新規 presentational コンポーネント `src/web/components/execution/BackendStatusBar.tsx`
  - Props: `state: BackendState`, `flavor: Flavor`, `onRetry: () => void`
  - `initializing`: 「Loading WASM…」/「Connecting to server…」
  - `disconnected`: 「Connection lost. Reconnecting…」（03 で使用）
  - `error`: エラーメッセージ + Retry ボタン
  - `ready`: 何も表示しない
- `ExecutionControls` に `disabled?: boolean`（backend 未準備）を追加し、Compile / Compile/Run / Run を無効化（Stop は `isRunning` のみで判断）
- 配置: `ExecutionContainer` の各タブで `ExecutionControls` の直上。atom の読み取りは container（`useNospaceExecution` の返り値経由）で行い、コンポーネントは props のみに依存させる

### `ExecutionBackend` インタフェース

本タスクでは変更しない（03 で `onConnectionChange` を追加する）。

## タスクステップ・チェックリスト

1. [ ] `backendStateAtom` / `BackendState` 型を追加
2. [ ] `useExecutionBackend` を上記設計に書き換え、`retry` を返す
3. [ ] `useNospaceExecution` に `backendState` / `retryBackend` を追加し、各ハンドラのガードを更新
4. [ ] loader をファクトリ化し、失敗時リセット
5. [ ] `ExecutionContainer` で flavor 変更時に `pendingAutoRunRef` をクリア
6. [ ] `BackendStatusBar` 追加、`ExecutionControls` に `disabled` 追加、`ExecutionContainer` で配線
7. [ ] テスト（loader のテストは新規 `src/tests/web/libs/nospace20Loader.spec.ts`）

### テスト

既存 `useExecutionBackend.spec.tsx` のフェイク factory / フェイク backend（DI）を拡張する。

| ケース |
|---|
| init が遅い backend A → flavor 切替 → backend B が先に ready → A の init 完了後も `backendRef` は B、A は dispose 済み |
| init 中にアンマウント → init 完了後に backend が dispose され `backendRef` は null |
| factory が reject → `backendState` が `error`、unhandled rejection が発生しない |
| init が reject → `backendState` が `error`、`backendRef` は null、`retry()` で再初期化され `ready` |
| dispose 済み backend がコールバックを呼んでも atom が変化しない |
| init 失敗で dispose された backend が後からコールバックを呼んでも atom が変化しない |
| flavor 切替で `executionStatus` が `idle`、`compileStatus` が null に戻り、compile 中に切り替えた後の Run で compileStatus が `success` にならない |
| loader（`createNospace20Loader` にフェイク import 関数を注入）: 初回失敗後、2 回目の `init()` で再度 import が呼ばれ成功する |

## 影響範囲

- `src/web/hooks/useExecutionBackend.ts`, `src/web/hooks/useNospaceExecution.ts`
- `src/web/stores/executionAtom.ts`
- `src/web/libs/nospace20/loader.ts`
- `src/web/components/execution/ExecutionControls.tsx`、新規 `BackendStatusBar.tsx`（+ scss）
- `src/web/containers/ExecutionContainer.tsx`
- テスト: `useExecutionBackend.spec.tsx`, `useNospaceExecution.spec.tsx`, `ExecutionControls.spec.tsx`, `ExecutionContainer.spec.tsx`
