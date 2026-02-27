# Mock ライブラリによるメソッド差し替え違反

## ルール

> Mock ライブラリ等によるメソッドの差し替えは禁止。依存性注入やテンプレートを使用する

## 違反一覧

### 1. `jest.mock()` によるモジュール全体のモック（4ファイル, 11箇所）

#### 1-1. `src/tests/web/WasmExecutionBackend.spec.ts` (L15-L44)

- `../../web/libs/nospace20/loader` モジュール全体を `jest.mock()` で差し替え
- `initNospace20Wasm` は `jest.fn().mockResolvedValue(undefined)` を使用
- **修正方針**: `WasmExecutionBackend` コンストラクタに loader を DI できるようにし、テストではフェイク loader を注入する

#### 1-2. `src/tests/web/NospaceEditor.spec.tsx` (L10-L22, 3箇所)

- `react-ace` コンポーネント全体をモック
- `ace-builds/src-noconflict/theme-monokai` テーマモジュールをモック
- `../../web/libs/nospace20/nospace-ace-mode` Ace mode モジュールをモック
- **修正方針**: 外部ライブラリの `jest.mock()` は、Jest の `moduleNameMapper` 設定で静的に解決する。コンポーネントの差し替えは props 経由で注入可能にする

#### 1-3. `src/tests/web/EditorContainer.spec.tsx` (L14-L24, 2箇所)

- `../../web/components/editor/NospaceEditor` コンポーネントをモック
- `../../web/hooks/useTestEditor` フックをモック（内部で `jest.fn()` 使用）
- **修正方針**: 子コンポーネントを props 経由で渡す。フックは DI パターンで注入

#### 1-4. `src/tests/web/ExecutionContainer.spec.tsx` (L19-L33, 5箇所)

- `TestEditorContainer`, `ExecutionOptions`, `CompileOptions`, `OutputPanel`, `InputPanel` の5つの子コンポーネントを全て `jest.mock()` で差し替え
- **修正方針**: 各サブコンポーネントのテストは個別に行い、統合テストとして必要な場合は子コンポーネントを props 経由で切替可能にする

### 2. `jest.fn().mockReturnThis()` による Express Response のモック（1ファイル, 2箇所）

#### 2-1. `src/tests/app/TestController.spec.ts` (L58-L59)

- `status: jest.fn().mockReturnThis()` / `json: jest.fn().mockReturnThis()`
- **修正方針**: `jest.fn()` を使わず、呼び出し記録用の配列を持つフェイク Response オブジェクトを手動実装する

### 3. `jest.fn()` による DI オブジェクト内メソッドの差し替え（2ファイル, 計6箇所）

#### 3-1. `src/tests/app/NospaceExecutionService.spec.ts` (L80)

- `ProcessSpawner.spawn` を `jest.fn(() => fakeProcess)` で実装
- L486 で `(fakeSpawner.spawn as jest.Mock).mock.calls[0][1]` のように jest.Mock の内部 API にアクセス
- **修正方針**: `spawn` をプレーン関数で実装し、呼び出し引数の記録は独自の配列で管理する

#### 3-2. `src/tests/web/useNospaceExecution.spec.tsx` (L34-L37, L112, L162-L164)

- `FakeExecutionBackend` 内で `jest.fn()` を使用 (`runMock`, `compileMock`, `sendStdinMock`, `killMock`)
- `backendFactory` に `jest.fn(async () => fakeBackend)` を使用
- `factoryMock` に `.mockResolvedValueOnce()` チェーンを使用
- **修正方針**: `FakeExecutionBackend` は呼び出し記録用の配列を持たせプレーン関数で実装。ファクトリも同様

### 4. `__mocks__/` ディレクトリによる自動モック（3ファイル）

#### 4-1. `src/__mocks__/fileMock.js`, `src/__mocks__/styleMock.js`

- `moduleNameMapper` 経由で CSS/画像ファイルの import をスタブ化
- **判定**: CSS/画像のスタブはビルド成果物の模倣でありロジックの差し替えではないため、**許容可能**

#### 4-2. `src/__mocks__/web/libs/env.ts`

- `import.meta.env` が Jest 環境で動作しないため `moduleNameMapper` で env モジュールを差し替え
- **判定**: 技術的制約に起因するため**許容可能**とするが、将来的にはビルド時の env 注入を検討

### 5. イベントハンドラとして `jest.fn()` を props に渡すケース

以下は既存メソッドの差し替えではなくコールバック props への `jest.fn()` 渡しであり、厳密なルール適用では避けるべきだが、呼び出し有無の検証手段としては一般的:

- `ExecutionControls.spec.tsx`, `CodeTextarea.spec.tsx`, `CollapsibleSection.spec.tsx`, `CompileOutputPanel.spec.tsx` 等の UI コンポーネントテスト
- `NospaceSocketClient.spec.ts`, `ServerExecutionBackend.spec.ts` のフェイク Socket 内 `emit`/`close`

**判定**: コールバックの呼び出し検証で `jest.fn()` を使用する点は将来的に手動記録方式への統一を検討するが、優先度は低い

---

## 修正計画

### Phase 1: 高優先度（jest.mock() の除去）

1. `ExecutionContainer.spec.tsx` — 5箇所の jest.mock() を除去し、子コンポーネントの props 注入化
2. `EditorContainer.spec.tsx` — jest.mock() を除去し、コンポーネント・フック DI 化
3. `WasmExecutionBackend.spec.ts` — loader の DI 化
4. `NospaceEditor.spec.tsx` — jest.mock() を moduleNameMapper 設定 or props 注入に変更

### Phase 2: 中優先度（jest.fn() の除去）

5. `useNospaceExecution.spec.tsx` — Fake クラス内の jest.fn() をプレーン関数に置換
6. `NospaceExecutionService.spec.ts` — spawn の jest.fn() をプレーン関数に置換
7. `TestController.spec.ts` — Response のフェイク実装を手動記録方式に変更

---

## 付録: テストファイル構成の軽微な違反

### `check-result-forms.test.tsx` が4つのモジュールをテスト

- ルール: 「Unit テストはモジュールごとに作成する」
- `SuccessTraceForm`, `SuccessIOForm`, `CompileErrorForm`, `ParseErrorForm` の4コンポーネントを1ファイルでテスト
- 同じディレクトリ配下の関連コンポーネントであり深刻度は低いが、各コンポーネントごとにテストファイルを分割すべき
