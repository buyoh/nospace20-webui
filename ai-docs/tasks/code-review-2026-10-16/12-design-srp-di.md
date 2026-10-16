# 12. 設計（SRP / DI / レイヤー分離）の改善点

- 重要度: **low**（一部 medium 相当の挙動不具合を含む）
- 対象: サーバ・クライアント全般

## 問題点

### サーバ

- **DI の不徹底**: `NospaceController` のコンストラクタ既定値 `new NospaceExecutionService()`、`defaultExecutionConfig = Config`、`ExpressViteDev` の Config 直接 import。組み立て（composition root）が分散
- **責務の混在**: `NospaceController` に socket↔session 管理・入力検証（欠如）・送信が混在。`NospaceExecutionService` に一時ファイル管理・引数組み立て・プロセス監視が混在
- **エラー種別の文字列判定**: `TestController.ts:47-57`, `:83-93`, `:113-123` で `includes('not found')` 等により 404/400 を判定。文言変更や fs エラーメッセージで誤判定しうる
- **状態型の重複**: `SessionStatus`（サービス）と `ExecutionStatus`（interfaces）が重複し、`'compiling'` のみコントローラーで合成

### クライアント

- **CompileOptions の DI 迂回**（medium 相当の不具合）: `CompileOptions.tsx:79-115`, `:124` の `useMemo(() => getWasmDerivedOptions(), [])` がマウント時に一度だけ評価され、WASM 未初期化時の fallback 選択肢で固定される。グローバル loader に直接依存し `WasmExecutionBackend` の Loader DI を迂回。websocket flavor でも使われる（コメント「WASM flavor でのみ使用」は事実と異なる）
- **ref の受け渡しによる低凝集**: `useExecutionBackend.ts:24-43` が `compileTargetRef` / `compileHadErrorRef` / `prevStatusRef` を外部公開し、`useNospaceExecution` が書き換えてコンパイル完了を判定。状態遷移が 2 hook に分散
- **`pendingAutoRunRef` の残留**: `ExecutionContainer.tsx:66`, `:93-102`, `:133-136`。ws 以外で成功した場合やガードで return した場合に null に戻らず、後の ws コンパイルで意図しない自動実行が起きる
- **ExecutionContainer の責務過多**（242 行）: タブ切替・4 種のパネル構成・auto-run 制御・サンプルロード
- **components/ の状態依存**: `TestEditorPanel` / `TestListPanel` / `InputPanel` / `OutputPanel` / `ExecutionOptions` / `CompileOptions` / `CompileOutputPanel` が atom / hook に直接依存。`InputPanel.tsx:39-44` は `outputEntriesAtom` に直接書き込み。AGENTS.md の「containers が状態を持つ」構造に反する
- **capabilities 未使用**: `ExecutionBackend.capabilities` がどこからも参照されない。`ExecutionOptions.tsx:31-42` は wasm で ignoreDebug を非表示にするが `supportsIgnoreDebug=true`。websocket で ON → wasm 切替で見えないまま有効
- **未使用コード**: `src/web/components/editor/CodeTextarea.tsx` はテストからのみ参照

## 違反しているルール・原則

- 単一責任原則（AGENTS.md）
- 依存性注入 / composition root
- AGENTS.md のディレクトリ構造（components は状態を持たない）

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | 組み立てを `MainServer` に集約し、既定値による暗黙依存を削除 | `MainServer`, Controller, Service, `ExpressViteDev` |
| 2 | 引数ビルダー・入力 Validator・セッションレジストリを独立クラス化 | Service, Controller（01・08 の修正と同時に実施推奨） |
| 3 | `NotFoundError` / `InvalidPathError` / `ConflictError` を定義し `instanceof` で判定 | `TestFileService`, `TestController`, テスト |
| 4 | 利用可能なコンパイルオプションを backend の capability として atom / hook から供給（最小対策: init 完了 atom を deps に追加） | `ExecutionBackend` IF, `useExecutionBackend`, `CompileOptions` |
| 5 | コンパイルセッションの状態を reducer / `useCompileSession` に閉じ込め、auto-run 制御を `useCompileAndRun` として切り出し全終了状態でクリア | `useExecutionBackend`, `useNospaceExecution`, `ExecutionContainer` |
| 6 | ExecutionContainer をタブごとのコンテナに分割 | `containers/`, 関連テスト |
| 7 | 状態依存の components を containers に移すか、props 経由に変更 | 該当コンポーネント、新規 container、テスト |
| 8 | UI 分岐を capabilities 駆動にする | `ExecutionOptions`, `useNospaceExecution` |
| 9 | `CodeTextarea` を `.trash/` に移動（テストも） | 当該ファイルのみ |
