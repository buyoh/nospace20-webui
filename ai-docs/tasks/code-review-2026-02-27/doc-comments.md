# 構造体のドキュメントコメント (JSDoc) 欠落

## ルール

> 構造体の概要は必ずドキュメントコメントとして追加する。関数は規模が小さい場合、省略する

## 違反一覧

### 1. `src/interfaces/NospaceTypes.ts` — 共有型定義（11件）

最も影響範囲が大きい。サーバ・クライアント間で共有される型定義に JSDoc が無い。

| 行 | 構造体 | 状態 |
|---|---|---|
| L3 | `type LanguageSubset` | JSDoc なし |
| L4 | `type CompileTarget` | JSDoc なし |
| L5 | `type InputMode` | JSDoc なし |
| L6-L11 | `type ExecutionStatus` | JSDoc なし |
| L13 | `interface CompileOptions` | フィールドコメントのみ、インターフェース概要なし |
| L20 | `interface ExecutionOptions` | 同上 |
| L33 | `interface RunOptions` | 同上 |
| L51 | `interface NospaceClientToServerEvents` | JSDoc なし |
| L70 | `interface NospaceServerToClientEvents` | JSDoc なし |
| L88 | `type OutputEntryType` | JSDoc なし |
| L90 | `interface OutputEntry` | JSDoc なし |

### 2. `src/app/Services/NospaceExecutionService.ts` — サービス層（3件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L51 | `type SessionStatus` | JSDoc なし |
| L65 | `interface SessionCallbacks` | 通常コメントのみ (JSDoc ではない) |
| L157 | `class NospaceExecutionService` | JSDoc なし |

### 3. `src/app/Controllers/NospaceController.ts` — コントローラー（1件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L11 | `class NospaceController` | JSDoc なし |

### 4. `src/web/services/WasmExecutionBackend.ts` — WASM バックエンド（1件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L19 | `class WasmExecutionBackend` | JSDoc なし |

### 5. `src/web/stores/` — Jotai Atom 定義（複数ファイル）

#### `executionAtom.ts`
| 行 | atom 名 | 状態 |
|---|---|---|
| L7 | `executionStatusAtom` | JSDoc なし |
| L8 | `currentSessionIdAtom` | JSDoc なし |
| L9 | `outputEntriesAtom` | JSDoc なし |
| L10 | `exitCodeAtom` | JSDoc なし |

#### `optionsAtom.ts`
| 行 | atom 名 | 状態 |
|---|---|---|
| L7 | `compileOptionsAtom` | JSDoc なし |
| L14 | `executionOptionsAtom` | JSDoc なし |

#### `editorAtom.ts`
| 行 | atom 名 | 状態 |
|---|---|---|
| L19 | `sourceCodeAtom` | JSDoc なし |

#### `flavorAtom.ts`
| 行 | 構造体 | 状態 |
|---|---|---|
| L4 | `type Flavor` | JSDoc なし |

### 6. `src/web/libs/nospace20/nospace20.d.ts` — WASM 型定義（9件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L4-L8 | `interface WasmError` | JSDoc なし |
| L10-L13 | `interface ResultErr` | JSDoc なし |
| L15-L20 | `interface RunResultOk` | JSDoc なし |
| L22 | `type RunResult` | JSDoc なし |
| L24-L27 | `interface CompileResultOk` | JSDoc なし |
| L29 | `type CompileResult` | JSDoc なし |
| L31-L33 | `interface ParseResultOk` | JSDoc なし |
| L35 | `type ParseResult` | JSDoc なし |
| L37-L42 | `interface VmStepResult` | JSDoc なし |

### 7. `src/web/libs/nospace20/loader.ts` — WASM ローダー（1件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L16-L26 | `type Nospace20Module` | JSDoc なし |

### 8. コンポーネント Props インターフェース（8件）

| ファイル | 行 | 構造体 |
|---|---|---|
| `src/web/components/test-editor/check-result-forms/SuccessIOForm.tsx` | L13 | `interface SuccessIOFormProps` |
| `src/web/components/test-editor/check-result-forms/SuccessTraceForm.tsx` | L6 | `interface SuccessTraceFormProps` |
| `src/web/components/test-editor/check-result-forms/CompileErrorForm.tsx` | L4 | `interface CompileErrorFormProps` |
| `src/web/components/test-editor/check-result-forms/ParseErrorForm.tsx` | L6 | `interface ParseErrorFormProps` |
| `src/web/components/test-editor/TestTreeNode.tsx` | L4 | `interface TestTreeNodeProps` |
| `src/web/components/test-editor/TestCaseEditForm.tsx` | L6 | `interface TestCaseEditFormProps` |
| `src/web/components/test-editor/TestCaseCreateForm.tsx` | L8 | `interface TestCaseCreateFormProps` |
| `src/web/components/test-editor/TestListPanel.tsx` | L7 | `interface TestListPanelProps` |

---

## 修正計画

### Phase 1: 高優先度

1. `src/interfaces/NospaceTypes.ts` — 全型・インターフェースに JSDoc 追加（共有型のため影響大）
2. `src/web/libs/nospace20/nospace20.d.ts` — WASM 型定義に JSDoc 追加

### Phase 2: 中優先度

3. `src/app/Services/NospaceExecutionService.ts` — クラス・型に JSDoc 追加
4. `src/app/Controllers/NospaceController.ts` — クラスに JSDoc 追加
5. `src/web/services/WasmExecutionBackend.ts` — クラスに JSDoc 追加
6. `src/web/stores/` 各ファイル — atom に JSDoc 追加

### Phase 3: 低優先度

7. `src/web/libs/nospace20/loader.ts` — 型に JSDoc 追加
8. Props インターフェース群 — JSDoc 追加
