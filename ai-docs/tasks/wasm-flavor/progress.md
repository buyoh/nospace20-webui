# WASM Flavor 実装進捗

## 完了したフェーズ

### Phase 9: ExecutionBackend 抽象化 ✅

- `ExecutionBackend` インターフェースと `ExecutionBackendCapabilities` を定義 - [src/web/services/ExecutionBackend.ts](../../src/web/services/ExecutionBackend.ts)
- `ServerExecutionBackend` 実装 (既存 Socket.IO ロジックを移行) - [src/web/services/ServerExecutionBackend.ts](../../src/web/services/ServerExecutionBackend.ts)
- `flavorAtom` 追加 - [src/web/stores/flavorAtom.ts](../../src/web/stores/flavorAtom.ts)
- `useNospaceExecution` リファクタリング (バックエンド抽象化対応) - [src/web/hooks/useNospaceExecution.ts](../../src/web/hooks/useNospaceExecution.ts)
- ServerExecutionBackend のユニットテスト追加 - [src/tests/web/ServerExecutionBackend.spec.ts](../../src/tests/web/ServerExecutionBackend.spec.ts)

**既知の問題:**
- useNospaceExecution.spec.tsx は内部実装変更により更新が必要（保留中）

### Phase 10: WASM ローダー + WasmExecutionBackend ✅

- ブラウザ向け WASM ローダー作成
  - `nospace20_browser.js`: nospace20.js のブラウザ向け修正版 (末尾の Node.js 固有コードを削除し init 関数を追加)
  - [src/web/libs/nospace20/loader.ts](../../src/web/libs/nospace20/loader.ts): WASM 初期化 API
- `WasmExecutionBackend` 実装 (step 実行、stdout ストリーミング) - [src/web/services/WasmExecutionBackend.ts](../../src/web/services/WasmExecutionBackend.ts)
- Vite 設定変更 (WASM アセット対応) - [vite.config.ts](../../vite.config.ts)
- useNospaceExecution で WASM バックエンドをサポート
- Jest 環境で `import.meta` の問題を解決
  - [src/web/libs/env.ts](../../src/web/libs/env.ts): 環境変数取得を分離
  - [src/web/libs/__mocks__/env.ts](../../src/web/libs/__mocks__/env.ts): テスト用モック
  - [src/tests/setupTests.ts](../../src/tests/setupTests.ts): グローバルモック設定

### Phase 11: Flavor 切り替え UI + 機能差異対応 (未完了)

**未実装:**
- Header に flavor セレクター追加
- ExecutionOptions の調整 (WASM 時に非対応オプションを非表示)
- CompileOptions コンポーネント追加
- ExecutionControls に Compile ボタン追加
- InputPanel の調整 (WASM 時は batch モードのみ)
- ExecutionContainer の更新

## 技術的な決定事項

### WASM ローダー実装

- **方法**: nospace20.js を直接修正してブラウザ向けバージョン (nospace20_browser.js) を作成
- **理由**: wasm-bindgen --target web での再生成が不可能な前提で、最小限の修正で実現
- **メンテナンス**: nospace20.js 更新時は nospace20_browser.js も手動で再適用が必要（コメントで明記）

### import.meta 問題の解決

- **問題**: Jest が Vite の `import.meta.env` を解析できない
- **解決**: 環境変数取得を別ファイル (env.ts) に分離し、Jest でモック
- **実装**: src/web/libs/env.ts + src/web/libs/__mocks__/env.ts

### Flavor のデフォルト

- Phase 9 期間中: 'server' (WASM バックエンド未実装のため)
- Phase 10 完了後: 'wasm' (サーバー不要で即座に使えるため)

## 残課題

1. **Phase 11 の UI 実装完了** (最優先)
   - flavor セレクター、機能差異に応じた UI の表示/非表示制御

2. **テストの更新** (高)
   - useNospaceExecution.spec.tsx を新しい実装に対応
   - WasmExecutionBackend のユニットテスト追加

3. **動作検証** (高)
   - WASM flavor で compile / run が正常に動作するか
   - Server flavor との切り替えが正常に動作するか

4. **ドキュメント更新** (中)
   - README に WASM flavor の説明を追加
   - 開発者向けドキュメントの更新

## 次のステップ

1. Phase 11 の UI 実装を完了
2. 全テストを実行してエラーを確認・修正
3. 動作検証 (手動テスト)
4. コミット & タスクを done-tasks/ に移動

## 参考

- [00-overview.md](../tasks/wasm-flavor/00-overview.md): 全体設計
- [01-wasm-loader.md](../tasks/wasm-flavor/01-wasm-loader.md): WASM ローダー設計
- [02-execution-backend.md](../tasks/wasm-flavor/02-execution-backend.md): ExecutionBackend 抽象化
- [03-frontend-integration.md](../tasks/wasm-flavor/03-frontend-integration.md): フロントエンド統合 (Phase 11)
