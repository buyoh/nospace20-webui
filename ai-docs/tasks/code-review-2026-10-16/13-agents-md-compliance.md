# 13. AGENTS.md 規約への準拠状況

- 重要度: **low**
- 対象: クライアント側コンポーネント・テスト

## 準拠している点

- `jest.mock` / `jest.spyOn` / `mockImplementation` の使用なし。DI・フェイク・`moduleNameMapper` スタブで対応。`jest.fn()` はコールバック用途のみ
- サーバ側の主要クラス・インタフェースにはドキュメントコメントあり

## 問題点

### (a) ドキュメントコメントの欠落

Props にはあるが、コンポーネント / 関数本体に概要コメントがないもの:

- `src/web/components/execution/OutputPanel.tsx:12`
- `src/web/components/execution/InputPanel.tsx:21`
- `src/web/components/execution/ExecutionControls.tsx:22`
- `src/web/components/editor/NospaceEditor.tsx:21`
- `src/web/components/editor/CodeTextarea.tsx:10`
- `src/web/components/layout/SplitPane.tsx:13`
- `src/web/containers/EditorContainer.tsx:31`
- `src/web/hooks/useNospaceExecution.ts:67`
- `src/web/pages/index.tsx:8`
- `src/web/components/test-editor/CheckResultEditor.tsx:9`（Props interface にもなし）
- `src/web/libs/nospace20/loader.ts:13`（`Nospace20Module` 型）

### (b) グローバル依存の差し替え・未注入

- `WasmExecutionBackend.spec.ts:94-98` が `globalThis.crypto` を `Object.defineProperty` で差し替え（07 (c) の問題を隠蔽）
- `useCheckResultEditor.ts:89` が `window.confirm` に直接依存し、確認分岐をテストできない
- ~~Config import 経由でテストが実ファイル `.env.local` を読む（10 (a) 参照）~~ → 解消済み（10 で ConfigLoader に分離、その後 [config-file-and-child-env](../../done-tasks/config-file-and-child-env/README.md) で `env.*.js` に移行し dotenv を廃止）

## 違反しているルール

- AGENTS.md: 構造体の概要は必ずドキュメントコメントとして追加
- AGENTS.md: Mock ライブラリ等による差し替え禁止、依存性注入を使用
- AGENTS.md: テストでファイルにアクセスしない

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | 上記箇所に JSDoc を追加 | 各ファイル（挙動変更なし） |
| 2 | ID 生成器・`confirm` 関数を DI 化し、テストのグローバル差し替えを削除 | `WasmExecutionBackend`, `useCheckResultEditor`, 各テスト |
| 3 | ~~Config の dotenv 読み込みをエントリポイントに移す（10 の解決策 2）~~ 対応済み | 10 参照 |
