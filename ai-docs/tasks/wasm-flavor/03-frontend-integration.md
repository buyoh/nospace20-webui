# フロントエンド統合・Flavor 切り替え

## 概要

`ExecutionBackend` 抽象化に伴い、フロントエンドのフック・ストア・コンポーネントを更新する。
Flavor の切り替え UI を追加し、WASM / Server を動的に切り替え可能にする。

## Flavor 状態管理

### `src/web/stores/flavorAtom.ts`

```typescript
import { atom } from 'jotai';

export type Flavor = 'wasm' | 'server';

/**
 * 現在選択されている flavor。
 * デフォルトは 'wasm'（サーバー不要でどこでも動作するため）。
 */
export const flavorAtom = atom<Flavor>('wasm');
```

### デフォルト flavor の決定ロジック

- サーバーが利用可能なら 'server' へ自動切り替え…は行わない（ユーザーの明示的選択を尊重）
- デフォルトは **'wasm'**（サーバー不要で即座に使えるため）
- ユーザーが明示的に 'server' を選択した場合のみ Socket.IO 接続を試行

## Hook のリファクタリング

### `useNospaceExecution.ts` の変更

既存の Socket.IO 直接依存を解消し、`ExecutionBackend` を介して実行を制御する。

```typescript
// src/web/hooks/useNospaceExecution.ts（リファクタリング後）

import { useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { sourceCodeAtom } from '../stores/editorAtom';
import { executionOptionsAtom, compileOptionsAtom } from '../stores/optionsAtom';
import {
  executionStatusAtom,
  currentSessionIdAtom,
  outputEntriesAtom,
  exitCodeAtom,
} from '../stores/executionAtom';
import { flavorAtom } from '../stores/flavorAtom';
import type { ExecutionBackend } from '../services/ExecutionBackend';
import { ServerExecutionBackend } from '../services/ServerExecutionBackend';
import { WasmExecutionBackend } from '../services/WasmExecutionBackend';

export function useNospaceExecution() {
  const flavor = useAtomValue(flavorAtom);
  const sourceCode = useAtomValue(sourceCodeAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const compileOptions = useAtomValue(compileOptionsAtom);
  const executionStatus = useAtomValue(executionStatusAtom);
  const setExecutionStatus = useSetAtom(executionStatusAtom);
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom);
  const setOutputEntries = useSetAtom(outputEntriesAtom);
  const setExitCode = useSetAtom(exitCodeAtom);

  const backendRef = useRef<ExecutionBackend | null>(null);

  const isRunning = executionStatus === 'running' || executionStatus === 'compiling';

  // flavor 変更時にバックエンドを切り替え
  useEffect(() => {
    const backend = flavor === 'wasm'
      ? new WasmExecutionBackend()
      : new ServerExecutionBackend();

    // コールバック設定
    backend.onOutput((entry) => {
      setOutputEntries((prev) => [...prev, entry]);
    });

    backend.onStatusChange((status, sessionId, exitCode) => {
      setExecutionStatus(status);
      setCurrentSessionId(sessionId);
      if (exitCode !== undefined) {
        setExitCode(exitCode ?? null);
      }
    });

    // 初期化
    backend.init().catch((err) => {
      console.error(`[useNospaceExecution] Failed to initialize ${flavor} backend:`, err);
    });

    // 旧バックエンドの破棄
    backendRef.current?.dispose();
    backendRef.current = backend;

    return () => {
      backend.dispose();
    };
  }, [flavor, setOutputEntries, setExecutionStatus, setCurrentSessionId, setExitCode]);

  const handleRun = useCallback((stdinData?: string) => {
    const backend = backendRef.current;
    if (!backend || !backend.isReady() || isRunning) return;

    setOutputEntries([]);

    backend.run(sourceCode, {
      language: compileOptions.language,
      debug: executionOptions.debug,
      ignoreDebug: executionOptions.ignoreDebug,
      inputMode: executionOptions.inputMode,
    }, stdinData);
  }, [sourceCode, executionOptions, compileOptions, isRunning, setOutputEntries]);

  const handleCompile = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || !backend.isReady() || isRunning) return;

    setOutputEntries([]);
    backend.compile(sourceCode, compileOptions);
  }, [sourceCode, compileOptions, isRunning, setOutputEntries]);

  const handleKill = useCallback(() => {
    backendRef.current?.kill();
  }, []);

  const handleSendStdin = useCallback((data: string) => {
    backendRef.current?.sendStdin(data);
  }, []);

  const handleClearOutput = useCallback(() => {
    setOutputEntries([]);
  }, [setOutputEntries]);

  return {
    isRunning,
    handleRun,
    handleCompile,
    handleKill,
    handleSendStdin,
    handleClearOutput,
  };
}
```

### `useNospaceSocket.ts` の扱い

`ServerExecutionBackend` に Socket.IO ロジックを移動するため、`useNospaceSocket.ts` は
Server flavor 利用時にも直接使用しなくなる。

**対応**: `useNospaceSocket.ts` は削除し、Socket.IO 管理は `ServerExecutionBackend` に完全移譲する。
`socketAtom.ts` も不要になるが、Server flavor のデバッグ・状態表示に使う場合は残しても良い。

## UI 変更

### Header に Flavor セレクター追加

```tsx
// src/web/components/layout/Header.tsx（変更後）

import React from 'react';
import { useAtom } from 'jotai';
import { flavorAtom, Flavor } from '../../stores/flavorAtom';
import './styles/Header.scss';

export const Header: React.FC = () => {
  const [flavor, setFlavor] = useAtom(flavorAtom);

  return (
    <header className="header">
      <h1>nospace Web IDE</h1>
      <div className="header-controls">
        <label className="flavor-selector">
          <span>Backend:</span>
          <select
            value={flavor}
            onChange={(e) => setFlavor(e.target.value as Flavor)}
          >
            <option value="wasm">WASM (Browser)</option>
            <option value="server">Server (Socket.IO)</option>
          </select>
        </label>
      </div>
    </header>
  );
};
```

### ExecutionOptions の調整

WASM flavor 時に interactive モードが選択できないようにする。

```tsx
// ExecutionOptions.tsx の inputMode セレクトに disabled を追加

<select
  value={options.inputMode}
  disabled={flavor === 'wasm'}
  onChange={...}
>
  <option value="batch">Batch</option>
  <option value="interactive" disabled={flavor === 'wasm'}>
    Interactive {flavor === 'wasm' ? '(Server only)' : ''}
  </option>
</select>
```

### ExecutionControls に Compile ボタン追加

WASM flavor では compile 機能が利用可能なので、Compile ボタンを追加する。

```tsx
// ExecutionControls.tsx（変更後）

interface ExecutionControlsProps {
  isRunning: boolean;
  onRun: () => void;
  onCompile: () => void;
  onKill: () => void;
  supportsCompile: boolean;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  onRun,
  onCompile,
  onKill,
  supportsCompile,
}) => {
  return (
    <div className="execution-controls">
      {supportsCompile && (
        <button onClick={onCompile} disabled={isRunning} className="btn-compile">
          Compile
        </button>
      )}
      <button onClick={onRun} disabled={isRunning} className="btn-run">
        Run
      </button>
      <button onClick={onKill} disabled={!isRunning} className="btn-kill">
        Stop
      </button>
    </div>
  );
};
```

### ExecutionContainer の変更

`handleCompile` と `supportsCompile` を子コンポーネントに渡す。

```tsx
// ExecutionContainer.tsx（変更後）

import { useAtomValue } from 'jotai';
import { flavorAtom } from '../stores/flavorAtom';
import { WasmExecutionBackend } from '../services/WasmExecutionBackend';

export const ExecutionContainer: React.FC = () => {
  const flavor = useAtomValue(flavorAtom);
  // ...
  const { handleRun, handleCompile, handleKill, ... } = useNospaceExecution();

  const supportsCompile = flavor === 'wasm';

  return (
    <div className="execution-container">
      <ExecutionOptions />
      <ExecutionControls
        isRunning={isRunning}
        onRun={handleRunWithInput}
        onCompile={handleCompile}
        onKill={handleKill}
        supportsCompile={supportsCompile}
      />
      {/* ... */}
    </div>
  );
};
```

## WASM 初期化タイミング

### 方針: Lazy 初期化

WASM モジュールのロードはユーザーが初めて WASM flavor を使用する（または起動時のデフォルト）
タイミングで行う。

```
アプリ起動
  ↓
flavor === 'wasm' (デフォルト)
  ↓
useNospaceExecution → WasmExecutionBackend.init()
  ↓
initNospace20Wasm() → fetch WASM → compile → instantiate
  ↓
ready!
```

### 初期化中の UI

初期化中は Run/Compile ボタンを disabled にし、ローディング表示を出す。

```typescript
// executionAtom.ts に追加
export const backendReadyAtom = atom<boolean>(false);
```

## テスト方針

### WasmExecutionBackend のユニットテスト

WASM モジュールのロードが必要なため、テスト環境（Jest）では WASM が動作しない可能性がある。

**対応**:
- `WasmExecutionBackend` のテストは `loader.ts` をモックして行う
- WASM API の戻り値をモックオブジェクトで再現
- integration テストは実際の WASM ファイルを使用（large テスト扱い）

### ServerExecutionBackend のユニットテスト

Socket.IO クライアントをモックして行う（既存の `useNospaceSocket.spec.tsx` を参考）。

### useNospaceExecution のユニットテスト

`ExecutionBackend` をモックして行う。flavor 切り替え時のバックエンド再初期化をテスト。

## 移行戦略

### Step 1: インターフェース定義

`ExecutionBackend` インターフェースと `ExecutionBackendCapabilities` を定義。

### Step 2: ServerExecutionBackend 作成

既存の `useNospaceSocket` のロジックを `ServerExecutionBackend` に移動。
この時点では `useNospaceExecution` は `ServerExecutionBackend` を直接使用。

### Step 3: useNospaceExecution リファクタリング

`flavorAtom` に基づいてバックエンドを切り替えるよう変更。
`useNospaceSocket` を削除。

### Step 4: WasmExecutionBackend 作成

WASM ローダー + `WasmExecutionBackend` を実装。

### Step 5: UI 更新

Header に flavor セレクター追加、ExecutionOptions/Controls の調整。

各ステップでテストを実行し、既存機能が壊れていないことを確認する。
