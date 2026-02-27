# 構造体のドキュメントコメント (JSDoc) 欠落

## ルール

> 構造体の概要は必ずドキュメントコメントとして追加する。関数は規模が小さい場合、省略する

## 違反一覧

### 1. `src/interfaces/NospaceTypes.ts` — 共有型定義（11件）

最も影響範囲が大きい。サーバ・クライアント間で共有される型定義に JSDoc が無い。

| 行 | 構造体 | 状態 |
|---|---|---|
| L3 | `type LanguageSubset` | ✅ 完了 |
| L4 | `type CompileTarget` | ✅ 完了 |
| L5 | `type InputMode` | ✅ 完了 |
| L6-L11 | `type ExecutionStatus` | ✅ 完了 |
| L13 | `interface CompileOptions` | ✅ 完了 |
| L20 | `interface ExecutionOptions` | ✅ 完了 |
| L33 | `interface RunOptions` | ✅ 完了 |
| L51 | `interface NospaceClientToServerEvents` | ✅ 完了 |
| L70 | `interface NospaceServerToClientEvents` | ✅ 完了 |
| L88 | `type OutputEntryType` | ✅ 完了 |
| L90 | `interface OutputEntry` | ✅ 完了 |

### 2. `src/app/Services/NospaceExecutionService.ts` — サービス層（3件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L51 | `type SessionStatus` | ✅ 完了 |
| L65 | `interface SessionCallbacks` | ✅ 既に JSDoc あり（確認済み） |
| L157 | `class NospaceExecutionService` | ✅ 完了 |

### 3. `src/app/Controllers/NospaceController.ts` — コントローラー（1件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L11 | `class NospaceController` | ✅ 完了 |

### 4. `src/web/services/WasmExecutionBackend.ts` — WASM バックエンド（1件）

| 行 | 構造体 | 状態 |
|---|---|---|
| L19 | `class WasmExecutionBackend` | ✅ 完了 |

### 5. `src/web/stores/` — Jotai Atom 定義（複数ファイル）

#### `executionAtom.ts`
| 行 | atom 名 | 状態 |
|---|---|---|
| L7 | `executionStatusAtom` | ✅ 完了 |
| L8 | `currentSessionIdAtom` | ✅ 完了 |
| L9 | `outputEntriesAtom` | ✅ 完了 |
| L10 | `exitCodeAtom` | ✅ 完了 |

#### `optionsAtom.ts`
| 行 | atom 名 | 状態 |
|---|---|---|
| L7 | `compileOptionsAtom` | ✅ 完了 |
| L14 | `executionOptionsAtom` | ✅ 完了 |

#### `editorAtom.ts`
| 行 | atom 名 | 状態 |
|---|---|---|
| L19 | `sourceCodeAtom` | ✅ 完了 |

#### `flavorAtom.ts`
| 行 | 構造体 | 状態 |
|---|---|---|
| L4 | `type Flavor` | ✅ 完了 |

### 6. コンポーネント Props インターフェース（8件）

| ファイル | 行 | 構造体 |
|---|---|---|
| `src/web/components/test-editor/check-result-forms/SuccessIOForm.tsx` | L13 | `interface SuccessIOFormProps` | ✅ 完了 |
| `src/web/components/test-editor/check-result-forms/SuccessTraceForm.tsx` | L6 | `interface SuccessTraceFormProps` | ✅ 完了 |
| `src/web/components/test-editor/check-result-forms/CompileErrorForm.tsx` | L4 | `interface CompileErrorFormProps` | ✅ 完了 |
| `src/web/components/test-editor/check-result-forms/ParseErrorForm.tsx` | L6 | `interface ParseErrorFormProps` | ✅ 完了 |
| `src/web/components/test-editor/TestTreeNode.tsx` | L4 | `interface TestTreeNodeProps` | ✅ 完了 |
| `src/web/components/test-editor/TestCaseEditForm.tsx` | L6 | `interface TestCaseEditFormProps` | ✅ 完了 |
| `src/web/components/test-editor/TestCaseCreateForm.tsx` | L8 | `interface TestCaseCreateFormProps` | ✅ 完了 |
| `src/web/components/test-editor/TestListPanel.tsx` | L7 | `interface TestListPanelProps` | ✅ 完了 |

---

## 修正計画

※ `src/web/libs/nospace20/` 以下のファイルは外部からコピーされるため対象外

### Phase 1: 高優先度

1. `src/interfaces/NospaceTypes.ts` — 全型・インターフェースに JSDoc 追加（共有型のため影響大） ✅

### Phase 2: 中優先度

3. `src/app/Services/NospaceExecutionService.ts` — クラス・型に JSDoc 追加 ✅
4. `src/app/Controllers/NospaceController.ts` — クラスに JSDoc 追加 ✅
5. `src/web/services/WasmExecutionBackend.ts` — クラスに JSDoc 追加 ✅
6. `src/web/stores/` 各ファイル — atom に JSDoc 追加 ✅

### Phase 3: 低優先度

7. Props インターフェース群 — JSDoc 追加 ✅

---

## 進捗

- **2026-02-27**: 全 Phase 完了。テスト 434 件全パス。
