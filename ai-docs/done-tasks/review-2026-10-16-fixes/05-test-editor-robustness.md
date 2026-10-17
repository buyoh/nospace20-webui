# 05. テストエディタのエラー処理・競合・状態同期

テストケースの読み込み・保存失敗を通知し、選択切替時の競合と編集内容の喪失を防ぎ、check.json エディタの状態同期を修正する。

作成日: 2026-10-16
ステータス: 完了
元指摘: [09-test-editor-error-handling.md](../code-review-2026-10-16/09-test-editor-error-handling.md)

## 設計・方針

### 現状の問題（要約）

| # | 問題 | 場所 |
|---|---|---|
| a | `loadTestCase` の reject が effect 内で未処理。保存・作成失敗は `console.error` のみ | `TestEditorPanel.tsx:51-55`, `useTestEditor.ts` |
| b | 素早い選択切替でレスポンス順序が逆転すると、選択と表示内容が食い違う | `TestEditorPanel.tsx` の effect |
| c | dirty 状態での選択変更・新規作成で、確認なしに編集内容を破棄 | `useTestTree.selectTest`, `useTestEditor.startCreate` |
| d | `value` 変化のたびに editMode を `form` に戻すため、JSON 編集中にフォームへ強制遷移する。`validationErrors` が再計算されない | `useCheckResultEditor.ts:56-75` |
| e | 不正 JSON の間は `onChange` が呼ばれず、Save すると最後に有効だった JSON が保存される | `useCheckResultEditor.handleJsonChange` |
| f | 「check が空文字ならファイル削除」の契約に対し、クライアントは `check \|\| undefined` で空文字を送れない。また空文字は不正 JSON 扱いで `onChange` されない | `useTestEditor.ts:63`, `TestTypes.ts:41` |

### a. エラー通知

- `src/web/stores/testEditorAtom.ts` に `testEditorErrorAtom = atom<string | null>(null)` を追加
- `useTestEditor`:
  - `loadTestCase` / `save` / `create` は**例外を再 throw しない**。失敗時はエラーメッセージを atom に設定し、`save` / `create` は `Promise<boolean>`（成功可否）を返す
  - `loadTestCase` 失敗時は `testCase` を `null` にする（選択中パスと異なる内容を表示し続けない）
  - 成功時・新たな操作開始時にエラーをクリア
  - `clearError()` を返す
- `TestEditorPanel`: `handleSave` / `handleCreate` は戻り値で分岐（成功時のみ `loadTree()`）。try/catch は不要になる
- 表示: 新規 presentational コンポーネント `src/web/components/test-editor/TestEditorErrorBanner.tsx`（Props: `message`, `onDismiss`）を `TestEditorPanel` の上部に配置

### b. 読み込みの競合

- `TestApiClient.fetchTestCase(path, signal?: AbortSignal)` に `signal` を追加し `fetch` に渡す
- `useTestEditor.loadTestCase(path, signal?)`:
  - 開始時に `testCase` を `null`、dirty を false にする（読み込み中にメインエディタで編集しても `updateSource` は `testCase` が null のため no-op となり、旧テストケースが dirty になって完了時に黙って上書きされる問題を防ぐ。未保存変更の破棄確認は c のガードで選択変更前に済んでいる）
  - await 後に `signal?.aborted` なら何もしない（`AbortError` もエラー扱いしない）
- `TestEditorPanel` の effect:
  ```ts
  useEffect(() => {
    if (!selectedPath || isCreateMode) return;
    const controller = new AbortController();
    void loadTestCase(selectedPath, controller.signal);
    return () => controller.abort();
  }, [selectedPath, isCreateMode]);
  ```

### c. 未保存変更の破棄確認

- 新規フック `src/web/hooks/useDiscardChangesGuard.ts`
  ```ts
  /** 確認ダイアログ関数（テスト時に差し替えるため DI） */
  export type ConfirmFn = (message: string) => boolean;
  /** 未保存の変更がある場合に破棄確認を行い、続行してよいかを返す */
  export function useDiscardChangesGuard(confirm: ConfirmFn = (m) => window.confirm(m)): () => boolean;
  ```
  `testEditorDirtyAtom` が false なら `true` を返し、true なら `confirm('Unsaved changes will be lost. Continue?')` の結果を返す
- 適用箇所:
  - `useTestTree.selectTest(path)`: 同一パスかつ作成モードでなければ何もしない。ガードが false なら選択を変えない。作成モード中の選択は作成モードを終了して選択したテストを読み込む（`testEditorCreateModeAtom` を false にする）
  - `useTestEditor.startCreate()`: ガードが false なら何もしない
  - `useTestEditor.cancelCreate()`: ガードを適用する（作成モード中にメインエディタで入力したソースも dirty として扱われるため）
- **作成成功後の状態**（現状 `create()` は `isCreateMode` を false にするだけで、`testCase`（path `'(new test case)'`）と dirty が残る。選択中パスがないと `PUT /api/tests/(new test case)` を送れてしまう）
  - `create()` 成功時は dirty を false にし、作成したパスを選択する。選択はガードを通らない内部用 setter（`selectedTestPathAtom` への直接書き込み）で行う。`TestEditorPanel.handleCreate` の `TODO: select the newly created test` を解消
  - 作成したパスが元の `selectedPath` と同一の場合でも再読み込みされるよう、effect の deps は `[selectedPath, isCreateMode]` のまま（`isCreateMode` の変化で再実行される）
- `useTestTree` / `useTestEditor` は `ConfirmFn` を引数（既定値あり）で受け取り、内部で `useDiscardChangesGuard` に渡す
- 対象外: タブ切替（Test Editor → 他モード）やページ離脱時の確認は将来タスク

### d. check.json エディタの状態同期

方針: **テストケースが切り替わったときだけ**エディタ状態を初期化する。`value` 変化への追従 effect は削除する。

- `useCheckResultEditor` は `useState` の遅延初期化で `value` から初期状態（`resultType` / `schema` / `editMode` / `jsonText` / `validationErrors`）を生成し、以後 `value` の変化に追従しない
  - 初期 `validationErrors` も計算する（現状は空配列で始まる）
  - ただし空白のみの `value`（check.json なし）は f と同じく「check なし」として有効扱いし、`validationErrors` は空、`isJsonValid` は true、editMode は `json`（`parseCheckResult('')` は null を返すため、特別扱いしないと check なしのテストを開いた瞬間に `Invalid JSON syntax` が出て Save が無効になる）
- 初期化のトリガーは remount とする:
  - `TestEditorPanel` で `<TestCaseEditForm key={testCase.path} ... />`
  - `TestCaseCreateForm` は作成モード開始ごとに mount されるため変更不要
- 注意: 同一パスの再読み込み（現状は発生しない）では再初期化されない。将来「変更を破棄して再読み込み」を追加する場合は key に読み込み世代番号を含める

### e. 不正 JSON での保存防止

- `useCheckResultEditor` の返り値に `isJsonValid: boolean`（JSON 構文として正しいか）を追加
- `CheckResultEditor` に `onValidityChange?: (valid: boolean) => void` を追加し、`isJsonValid` 変化時に通知
- `TestCaseEditForm` は `const [checkValid, setCheckValid] = useState(true)` を持ち、Save を `!isDirty || isSaving || !checkValid` で無効化。不正時は「Fix JSON syntax errors before saving」を表示
- スキーマ検証エラー（`validateCheckResult` の結果）は警告表示のみとし、保存は妨げない（現状の挙動を維持）
- `TestCaseCreateForm` も同様に作成ボタンを無効化

### f. check.json 削除の契約

- `useCheckResultEditor.handleJsonChange`: 空白のみの文字列は「check なし」として有効扱いし、`onChange('')` を呼ぶ（`validationErrors` は空）
- `useTestEditor.save`: `check: testCase.check ?? undefined`（`''` はそのまま送り、サーバ側でファイル削除。`null` は「変更しない」）
- `create` は従来通り `check || undefined`（空なら作成しない）
- `TestCaseEditForm` の check 入力欄付近に「空にして保存すると .check.json を削除します」と表示

## タスクステップ・チェックリスト

1. [x] a: `testEditorErrorAtom`、`useTestEditor` のエラー処理変更、`TestEditorErrorBanner`
2. [x] b: `TestApiClient` の signal 対応、`loadTestCase` / effect の中断処理
3. [x] c: `useDiscardChangesGuard` と `selectTest` / `startCreate` / `cancelCreate` への適用、作成成功後の状態リセットと新パス選択
4. [x] d: `useCheckResultEditor` の初期化方式変更、`TestCaseEditForm` に key
5. [x] e: `isJsonValid` / `onValidityChange`、Save / Create ボタンの無効化
6. [x] f: 空 check の扱いと `save` の契約修正
7. [x] テスト

### テスト

`TestApiClient` はフェイク実装（同インタフェースのクラス）を hook に注入する。`confirm` は `ConfirmFn` の DI で差し替える（`window.confirm` の差し替えは行わない）。

| 対象 | ケース |
|---|---|
| `useTestEditor.spec`（新規） | fetch 失敗で `testEditorErrorAtom` に設定・`testCase` が null・例外が外に出ない |
| `useTestEditor.spec` | save 失敗で false を返し dirty のまま |
| `useTestEditor.spec` | abort 済み signal の読み込み結果が反映されない |
| `useTestEditor.spec` | `check: ''` で保存すると API に `''` が渡る / `null` なら `undefined` |
| `useTestEditor.spec` | 読み込み開始時に `testCase` が null になり、その間の `updateSource` で dirty にならない |
| `useTestEditor.spec` | 作成成功後に dirty が false、`selectedTestPathAtom` が新パス、作成モード解除 |
| `useTestEditor.spec` | dirty 時の `cancelCreate` / `startCreate` で confirm が false → 状態が変わらない |
| `useTestTree.spec`（新規） | dirty 時に confirm が false → 選択が変わらない / true → 変わる |
| `useTestTree.spec` | 作成モード中の選択で作成モードが解除される |
| `CheckResultEditor.test.tsx` | 空の初期値でエラー表示なし・`onValidityChange(true)` |
| `CheckResultEditor.test.tsx` | JSON モードで有効な JSON を入力してもフォームモードに戻らない |
| `CheckResultEditor.test.tsx` | 不正 JSON で `onValidityChange(false)` |
| `CheckResultEditor.test.tsx` | 空文字入力で `onChange('')` が呼ばれエラーなし |
| `CheckResultEditor.test.tsx` | 初期値の schema エラーが初期表示時に表示される |

## 影響範囲

- `src/web/hooks/useTestEditor.ts`, `useTestTree.ts`, `useCheckResultEditor.ts`、新規 `useDiscardChangesGuard.ts`
- `src/web/stores/testEditorAtom.ts`
- `src/web/services/TestApiClient.ts`
- `src/web/components/test-editor/TestEditorPanel.tsx`, `TestCaseEditForm.tsx`, `TestCaseCreateForm.tsx`, `CheckResultEditor.tsx`、新規 `TestEditorErrorBanner.tsx`（+ scss）
- `src/web/containers/TestEditorContainer.tsx`（`startCreate` の戻り値変化なし。変更不要の見込み）
- サーバ側の変更なし
