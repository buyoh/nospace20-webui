# エディタ コンパイルエラー アノテーション表示

## 概要

コンパイルエラー発生時に、Ace Editor のアノテーション機能を用いてエラー該当行にマーカー（エラーアイコン + メッセージ）を表示する。

## 背景

現状、コンパイルエラーは出力パネル（`outputEntriesAtom`）に `type: 'stderr'` のテキストとして表示されるのみで、エディタ上ではどの行にエラーがあるか視覚的に分からない。Ace Editor は `annotations` API を持っており、ガッター（行番号横）にエラー/警告アイコンを表示し、ホバーでメッセージを確認できる。

## 現状分析

### データフロー（WASM flavor）

```
nospace20.compile(code, target, language)
  → CompileResult = { success: true, output } | { success: false, errors: WasmError[] }
    → formatErrorEntries(result.errors) で文字列に変換 ← ★ここで行情報が消失
      → outputCallback({ type: 'stderr', data: errorMessages })
        → outputEntriesAtom に追加
```

### エラーデータ型

```typescript
// src/web/libs/nospace20/nospace20.d.ts
interface WasmError {
  message: string;
  line?: number;    // 1-based
  column?: number;  // 1-based
}

// src/web/libs/formatNospaceErrors.ts
interface NospaceErrorEntry {
  message: string;
  line?: number;
  column?: number;
}
```

### 関連コンポーネント

| ファイル | 役割 |
|---|---|
| `src/web/components/editor/NospaceEditor.tsx` | Ace Editor ラッパー |
| `src/web/containers/EditorContainer.tsx` | エディタの状態管理コンテナ |
| `src/web/services/WasmExecutionBackend.ts` | WASM コンパイル実行 |
| `src/web/hooks/useNospaceExecution.ts` | 実行/コンパイルフック |
| `src/web/stores/executionAtom.ts` | 実行関連 atom |
| `src/web/libs/formatNospaceErrors.ts` | エラー整形ユーティリティ |

## ドキュメント構成

| ファイル | 内容 |
|---|---|
| `00-overview.md` | 本ドキュメント（概要） |
| `01-design.md` | 詳細設計 |

## 進捗

### 2026-02-25 — 実装完了

以下のファイルを変更・新規作成して実装を完了した。

| ファイル | 変更内容 |
|---|---|
| `src/web/stores/compileErrorsAtom.ts` | 新規作成。`NospaceErrorEntry[]` を保持する atom |
| `src/web/services/ExecutionBackend.ts` | `onCompileErrors` メソッドをインターフェースに追加 |
| `src/web/services/WasmExecutionBackend.ts` | `compileErrorsCallback` を追加し compile 失敗時に呼び出す |
| `src/web/services/ServerExecutionBackend.ts` | `onCompileErrors` を no-op で実装 |
| `src/web/hooks/useNospaceExecution.ts` | `compileErrorsAtom` 購読・クリア処理を追加 |
| `src/web/components/editor/NospaceEditor.tsx` | `annotations` prop を追加し AceEditor に渡す |
| `src/web/containers/EditorContainer.tsx` | `compileErrorsAtom` を変換して `NospaceEditor` に渡す |
| `src/tests/web/compileErrorsAtom.spec.ts` | 新規作成。atom の初期値テスト |
| `src/tests/web/NospaceEditor.spec.tsx` | 新規作成。annotations prop 伝達テスト |
| `src/tests/web/EditorContainer.spec.tsx` | 新規作成。line 1-based → row 0-based 変換テスト |
| `src/tests/web/WasmExecutionBackend.spec.ts` | `onCompileErrors` コールバックのテストを追加 |
| `src/tests/web/useNospaceExecution.spec.tsx` | `FakeExecutionBackend` に `onCompileErrors` を追加 |

テスト結果: **195 テスト全パス**
