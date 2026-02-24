# エディタ コンパイルエラー アノテーション表示 — 詳細設計

## 設計方針

構造化エラー情報（行番号付き）を新しい Jotai atom に保持し、`NospaceEditor` コンポーネントの `annotations` prop を通じて Ace Editor に渡す。

## 変更対象ファイルと変更内容

### 1. 新規 atom: `compileErrorsAtom`

**ファイル**: `src/web/stores/compileErrorsAtom.ts`（新規作成）

```typescript
import { atom } from 'jotai';
import type { NospaceErrorEntry } from '../libs/formatNospaceErrors';

/** コンパイルエラーの構造化情報を保持する atom */
export const compileErrorsAtom = atom<NospaceErrorEntry[]>([]);
```

`NospaceErrorEntry[]` をそのまま保持する。Ace annotation への変換はビュー層（`EditorContainer`）で行う。

---

### 2. `ExecutionBackend` インターフェース拡張

**ファイル**: `src/web/services/ExecutionBackend.ts`

新しいコールバックを追加:

```typescript
onCompileErrors(callback: (errors: NospaceErrorEntry[]) => void): void;
```

---

### 3. `WasmExecutionBackend` の変更

**ファイル**: `src/web/services/WasmExecutionBackend.ts`

- `compileErrorsCallback` フィールドを追加。
- `compile()` メソッドでエラー発生時、`formatErrorEntries` による文字列化に加えて、`compileErrorsCallback` に構造化エラー配列を渡す。
- `onCompileErrors()` メソッドを実装。

変更箇所（compile メソッド内、エラー分岐）:

```typescript
// 既存: 文字列化して stderr に送る
const errorMessages = formatErrorEntries(result.errors);
this.outputCallback?.({ type: 'stderr', data: errorMessages + '\n', timestamp: Date.now() });

// 追加: 構造化エラーを渡す
this.compileErrorsCallback?.(result.errors);

this.statusCallback?.('error', sessionId);
```

catch ブロックの `isNospaceErrorResult(e)` 分岐でも同様に:

```typescript
if (isNospaceErrorResult(e)) {
  this.compileErrorsCallback?.(e.errors);
}
```

---

### 4. `ServerExecutionBackend` の変更

**ファイル**: `src/web/services/ServerExecutionBackend.ts`

websocket flavor は現在 `supportsCompile: false` でコンパイル未対応。`onCompileErrors` は no-op で実装する。

```typescript
onCompileErrors(_callback: (errors: NospaceErrorEntry[]) => void): void {
  // websocket flavor does not support compile
}
```

---

### 5. `useNospaceExecution` フックの変更

**ファイル**: `src/web/hooks/useNospaceExecution.ts`

- `compileErrorsAtom` を import し、`setCompileErrors` を取得。
- backend 初期化時に `backend.onCompileErrors` コールバックを設定:

```typescript
backend.onCompileErrors((errors) => {
  setCompileErrors(errors);
});
```

- `handleCompile` / `handleRun` 実行開始時に `setCompileErrors([])` でエラーをクリア。

---

### 6. `NospaceEditor` コンポーネントの変更

**ファイル**: `src/web/components/editor/NospaceEditor.tsx`

#### Props 拡張

```typescript
import type { Ace } from 'ace-builds';

interface NospaceEditorProps {
  value: string;
  onChange: (value: string) => void;
  annotations?: Ace.Annotation[];
}
```

#### AceEditor に annotations を渡す

```tsx
<AceEditor
  // ...既存の props
  annotations={annotations}
/>
```

`react-ace` の `AceEditor` コンポーネントは `annotations` prop をサポートしており、`editor.session.setAnnotations()` を内部的に呼び出す。

---

### 7. `EditorContainer` コンテナの変更

**ファイル**: `src/web/containers/EditorContainer.tsx`

- `compileErrorsAtom` を購読。
- `NospaceErrorEntry[]` を Ace annotation 形式に変換して `NospaceEditor` に渡す。

```typescript
import { useAtomValue } from 'jotai';
import { compileErrorsAtom } from '../stores/compileErrorsAtom';
import type { Ace } from 'ace-builds';

// コンポーネント内:
const compileErrors = useAtomValue(compileErrorsAtom);

const annotations: Ace.Annotation[] = compileErrors
  .filter((e) => e.line != null)
  .map((e) => ({
    row: e.line! - 1,  // Ace は 0-based row
    column: e.column ?? 0,
    text: e.message,
    type: 'error',
  }));

// NospaceEditor に渡す:
<NospaceEditor value={displayValue} onChange={handleChange} annotations={annotations} />
```

**注意**: `line` が `undefined` のエラーはアノテーション表示できないためフィルタする（出力パネルの stderr 表示は維持される）。

---

## Ace Annotation 型

```typescript
// ace-builds より
interface Annotation {
  row: number;      // 0-based
  column: number;   // 0-based
  text: string;     // ツールチップに表示されるメッセージ
  type: 'error' | 'warning' | 'info';
}
```

## データフロー（変更後）

```
nospace20.compile(code, target, language)
  → CompileResult = { success: false, errors: WasmError[] }
    ├─→ formatErrorEntries → outputCallback (stderr) → outputEntriesAtom  ← 既存（変更なし）
    └─→ compileErrorsCallback(errors) → compileErrorsAtom                 ← 新規
         → EditorContainer が購読
           → NospaceErrorEntry[] → Ace.Annotation[] に変換
             → NospaceEditor annotations prop
               → Ace Editor ガッターにエラーアイコン表示
```

## エラークリアのタイミング

| イベント | 動作 |
|---|---|
| コンパイル開始 | `compileErrorsAtom` を `[]` にクリア |
| 実行開始 | `compileErrorsAtom` を `[]` にクリア |
| ソースコード編集 | クリアしない（次のコンパイルまでエラー表示を維持） |
| flavor 切り替え | backend 再初期化時に `compileErrorsAtom` を `[]` にクリア |

## テスト計画

### Unit テスト

1. **`compileErrorsAtom` テスト**: atom の初期値が `[]` であること
2. **`NospaceEditor` テスト**: `annotations` prop が AceEditor に渡されること
3. **`EditorContainer` テスト**: `compileErrorsAtom` の値が Ace annotation 形式に変換されること（`line` 1-based → `row` 0-based 変換）
4. **`WasmExecutionBackend` テスト**: コンパイルエラー時に `onCompileErrors` コールバックが呼ばれること
5. **`useNospaceExecution` テスト**: コンパイルエラー時に `compileErrorsAtom` が更新されること、実行開始時にクリアされること

### 注意点

- `line` が `undefined` のエラーエントリはアノテーションに含めない
- Ace の `row` は 0-based、nospace の `line` は 1-based なので変換が必要
- `column` も同様に nospace は 1-based の可能性がある（要確認、Ace は 0-based）
