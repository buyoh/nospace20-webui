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

### 機能差異に基づく UI 表示制御の方針

flavor によって対応しない機能の UI 要素は **非表示（DOM から除去）** を基本とする。
`disabled` ではなく非表示にすることで、対応しない機能がそもそも存在しないように見せ、ユーザーの混乱を避ける。

ただし、リスト中の 1 項目のみが非対応の場合は `disabled` + 理由表記（例: `(Server only)`）を使う。

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

WASM flavor 時に以下の変更を行う：

#### 1. `--ignore-debug` チェックボックス → **非表示**

WASM の `run()` / `WasmWhitespaceVM` に `ignoreDebug` パラメータが無いため。

#### 2. `inputMode` セレクター → **非表示**

WASM では batch モード固定のため、選択肢を出す意味がない。
flavor 切り替え時に `inputMode` を `'batch'` に自動リセットする。

#### 3. `language` セレクター → **コンテキスト依存**

- **run 時**: WASM の `run()` / `WasmWhitespaceVM` に language パラメータが無いため **非表示**
  （常に standard として動作。ws は language='ws' 選択時に `fromWhitespace` を使い分ける）
- **compile 時**: `compile(source, target, lang_std)` は lang_std を受け付けるため **表示**

```tsx
// ExecutionOptions.tsx（変更後）

import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../../stores/optionsAtom';
import { flavorAtom } from '../../stores/flavorAtom';
import './styles/ExecutionOptions.scss';

export const ExecutionOptions: React.FC = () => {
  const [options, setOptions] = useAtom(executionOptionsAtom);
  const flavor = useAtomValue(flavorAtom);
  const isWasm = flavor === 'wasm';

  return (
    <div className="execution-options">
      <h3>Execution Options</h3>

      {/* Debug trace — 両 flavor で利用可能 */}
      <div className="option-group">
        <label>
          <input
            type="checkbox"
            checked={options.debug}
            onChange={(e) =>
              setOptions({ ...options, debug: e.target.checked })
            }
          />
          <span>Debug trace (--debug)</span>
        </label>
      </div>

      {/* Ignore debug — Server のみ */}
      {!isWasm && (
        <div className="option-group">
          <label>
            <input
              type="checkbox"
              checked={options.ignoreDebug}
              onChange={(e) =>
                setOptions({ ...options, ignoreDebug: e.target.checked })
              }
            />
            <span>Ignore debug functions (--ignore-debug)</span>
          </label>
        </div>
      )}

      {/* Input Mode — Server のみ（WASM は batch 固定） */}
      {!isWasm && (
        <div className="option-group">
          <label>
            <span>Input Mode:</span>
            <select
              value={options.inputMode}
              onChange={(e) =>
                setOptions({
                  ...options,
                  inputMode: e.target.value as 'batch' | 'interactive',
                })
              }
            >
              <option value="batch">Batch</option>
              <option value="interactive">Interactive</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
};
```

### CompileOptions の表示制御

CompileOptions（language / target セレクター）は WASM flavor の compile 時のみ表示する。

```tsx
// CompileOptions.tsx — WASM flavor でのみ表示
// ExecutionContainer が flavor を見て表示/非表示を制御

{flavor === 'wasm' && <CompileOptions />}
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
flavor に応じて CompileOptions、InputPanel の表示を制御する。

```tsx
// ExecutionContainer.tsx（変更後）

import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { executionOptionsAtom } from '../stores/optionsAtom';
import { flavorAtom } from '../stores/flavorAtom';
import { ExecutionOptions } from '../components/execution/ExecutionOptions';
import { CompileOptions } from '../components/execution/CompileOptions';
import { ExecutionControls } from '../components/execution/ExecutionControls';
import { OutputPanel } from '../components/execution/OutputPanel';
import { InputPanel } from '../components/execution/InputPanel';
import { useNospaceExecution } from '../hooks/useNospaceExecution';

export const ExecutionContainer: React.FC = () => {
  const flavor = useAtomValue(flavorAtom);
  const executionOptions = useAtomValue(executionOptionsAtom);
  const [batchInput, setBatchInput] = useState('');
  const {
    isRunning,
    handleRun,
    handleCompile,
    handleKill,
    handleSendStdin,
    handleClearOutput,
  } = useNospaceExecution();

  const isWasm = flavor === 'wasm';
  const supportsCompile = isWasm;
  const supportsInteractiveStdin = !isWasm;

  const handleRunWithInput = () => {
    // WASM flavor では常に batch、Server flavor では executionOptions.inputMode に従う
    const inputMode = isWasm ? 'batch' : executionOptions.inputMode;
    handleRun(inputMode === 'batch' ? batchInput : undefined);
  };

  return (
    <div className="execution-container">
      <ExecutionOptions />
      {/* CompileOptions は WASM flavor でのみ表示 */}
      {supportsCompile && <CompileOptions />}
      <ExecutionControls
        isRunning={isRunning}
        onRun={handleRunWithInput}
        onCompile={handleCompile}
        onKill={handleKill}
        supportsCompile={supportsCompile}
      />
      <OutputPanel onClear={handleClearOutput} />
      {/* InputPanel:
          - WASM: batch input のみ表示
          - Server: executionOptions.inputMode に応じて batch/interactive を表示 */}
      <InputPanel
        isRunning={isRunning}
        onSendStdin={handleSendStdin}
        batchInput={batchInput}
        onBatchInputChange={setBatchInput}
        forceBatchMode={isWasm}
      />
    </div>
  );
};
```

### InputPanel の変更

`forceBatchMode` プロパティを追加。`true` の場合は `executionOptions.inputMode` を無視して
常に batch UI を表示する（interactive 入力欄を非表示にする）。

```tsx
// InputPanel.tsx（変更後）

interface InputPanelProps {
  isRunning: boolean;
  onSendStdin: (data: string) => void;
  batchInput?: string;
  onBatchInputChange?: (value: string) => void;
  /** true の場合、inputMode に関わらず batch UI のみ表示 */
  forceBatchMode?: boolean;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  isRunning,
  onSendStdin,
  batchInput = '',
  onBatchInputChange,
  forceBatchMode = false,
}) => {
  const executionOptions = useAtomValue(executionOptionsAtom);
  // ...

  // WASM flavor（forceBatchMode=true）の場合は常に batch UI
  const effectiveInputMode = forceBatchMode ? 'batch' : executionOptions.inputMode;

  if (effectiveInputMode === 'interactive') {
    // Interactive 入力 UI（Server flavor のみ到達）
    return ( /* ... interactive UI ... */ );
  }

  // Batch 入力 UI
  return ( /* ... batch UI ... */ );
};
```

### Flavor 切り替え時のオプション自動リセット

flavor を WASM に切り替えた際、Server 専用オプションが不整合な値のままにならないよう
自動リセットする。

```typescript
// flavorAtom.ts に派生 effect を追加するか、
// useNospaceExecution 内で flavor 変更を検知してリセット

useEffect(() => {
  if (flavor === 'wasm') {
    // interactive → batch に強制リセット
    setExecutionOptions((prev) => ({
      ...prev,
      inputMode: 'batch',
      ignoreDebug: false,  // WASM 非対応のためリセット
    }));
  }
}, [flavor]);
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
