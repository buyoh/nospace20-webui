# テスト編集機能: モード切り替え・統合

## 概要

既存の ExecutionContainer に「Test Editor」モードを追加し、Execution / Compile / Test Editor のモード切り替えを統合する。

## モード体系

### 現状のモード

| モード | 条件 | 内容 |
|--------|------|------|
| Execution | 全 flavor | ソースコード実行 |
| Compile | WASM flavor のみ | コンパイルのみ実行 |

### 変更後のモード

| モード | 条件 | 内容 |
|--------|------|------|
| Execution | 全 flavor | ソースコード実行 |
| Compile | WASM flavor のみ | コンパイルのみ実行 |
| Test Editor | WebSocket flavor のみ | テストケース管理 |

## 型の変更

### `OperationMode` 型の拡張

```typescript
// 現在
type OperationMode = 'execution' | 'compile';

// 変更後
type OperationMode = 'execution' | 'compile' | 'test-editor';
```

## ExecutionContainer の変更

### モード切り替えタブの表示ロジック

```typescript
// 現在: WASM flavor でのみ Execution / Compile タブを表示
// 変更後: 複数モード利用可能な場合にタブを表示

const isWasm = flavor === 'wasm';
const isWebSocket = flavor === 'websocket';
const supportsCompileMode = isWasm;
const supportsTestEditor = isWebSocket;
const showModeTabs = supportsCompileMode || supportsTestEditor;
```

### タブ表示

```tsx
{showModeTabs && (
  <div className="operation-mode-tabs">
    <button
      className={`mode-tab ${operationMode === 'execution' ? 'active' : ''}`}
      onClick={() => setOperationMode('execution')}
    >
      Execution
    </button>
    {supportsCompileMode && (
      <button
        className={`mode-tab ${operationMode === 'compile' ? 'active' : ''}`}
        onClick={() => setOperationMode('compile')}
      >
        Compile
      </button>
    )}
    {supportsTestEditor && (
      <button
        className={`mode-tab ${operationMode === 'test-editor' ? 'active' : ''}`}
        onClick={() => setOperationMode('test-editor')}
      >
        Test Editor
      </button>
    )}
  </div>
)}
```

### Test Editor モードの描画

```tsx
{operationMode === 'test-editor' && (
  <TestEditorContainer />
)}
```

### 強制モードリセット

```typescript
useEffect(() => {
  if (!supportsCompileMode && operationMode === 'compile') {
    setOperationMode('execution');
  }
  if (!supportsTestEditor && operationMode === 'test-editor') {
    setOperationMode('execution');
  }
}, [supportsCompileMode, supportsTestEditor]);
```

## 新規コンテナ

### `src/web/containers/TestEditorContainer.tsx`（新規）

テスト編集モード全体を統括するコンテナ。

```typescript
export const TestEditorContainer: React.FC = () => {
  // useTestTree() でツリー管理
  // useTestEditor() で編集管理
  // レイアウト: 上部にTestListPanel、下部にTestEditorPanel
  // または SplitPane で左にリスト、右にエディタ
};
```

**レイアウト案:**

右ペイン内を縦分割する:

```
┌──────────────────────────────────────┐
│ [Execution] [Test Editor]            │  ← モードタブ
├──────────────────────────────────────┤
│ [+ New Test]                         │
│ ▼ passes/                            │
│   ▶ operators/                       │
│   ▶ control_flow/                    │  ← テスト一覧（上部、高さ可変）
│   ○ c000                             │
│   ○ c001                             │
├──────────────────────────────────────┤
│ passes/operators/arith_002           │
│                                      │
│ Source (.ns)                         │
│ ┌──────────────────────────────────┐ │
│ │ ...                              │ │  ← テスト編集（下部）
│ └──────────────────────────────────┘ │
│                                      │
│ Expected Result (.check.json)        │
│ ┌──────────────────────────────────┐ │
│ │ ...                              │ │
│ └──────────────────────────────────┘ │
│              [Save]                  │
└──────────────────────────────────────┘
```

## ファイル構成

### 新規ファイル

| ファイル | 役割 |
|---------|------|
| `src/web/containers/TestEditorContainer.tsx` | テスト編集モード全体のコンテナ |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/web/containers/ExecutionContainer.tsx` | `OperationMode` 拡張、テストエディタタブ追加 |
| `src/web/containers/styles/ExecutionContainer.scss` | タブスタイル調整（必要に応じて） |

## EnvConfig のフロントエンド連携

テスト編集モードの表示可否は `APPLICATION_FLAVOR` の値で制御する。
現在 `VITE_APPLICATION_FLAVOR` としてフロントエンドに渡されている仕組みを利用するため、追加の env 設定は不要。

`flavorAtom` が `'websocket'` の場合にのみ Test Editor タブを表示。

## 将来の拡張可能性

- テスト一覧からテストケースを選択 → 左ペインのエディタにソースをロード → 実行モードで Run
- テスト結果の一括実行・レポート機能
- テストケースの削除・リネーム機能
- ドラッグ&ドロップによるカテゴリ移動
