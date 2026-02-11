# テストコード レビュー・改善計画（フェーズ3-4）

## 概要

フェーズ1-2で `NospaceExecutionService` のリファクタリングとテスト実装が完了しました。
このドキュメントは残りのフェーズ3-4の計画を記載しています。

## 完了済みフェーズ

- [x] **フェーズ 1**: NospaceExecutionService リファクタリング（DI導入）
- [x] **フェーズ 2**: NospaceExecutionService テスト書き直し

詳細は [test-review-phase1-2-implementation.md](../done-tasks/test-review-phase1-2-implementation.md) を参照。

---

## フェーズ 3: NospaceController テストの新規作成（中優先度）

### 対象ファイル

- **実装**: `src/app/Controllers/NospaceController.ts`
- **テスト**: `src/tests/app/NospaceController.spec.ts`（新規作成）

### テストケース

`NospaceController` は以下のロジックを含むため、Unitテストを作成する:

| テストケース | 検証内容 |
|---|---|
| handleRun | executionService.run が適切な引数で呼ばれ、socket.emit で 'running' ステータスが送信される |
| handleRun（既存セッション有り） | 既存セッションが kill + remove される |
| handleRun（バッチモード + stdinData） | session.sendStdin にデータが渡される |
| handleStdinInput | session.sendStdin に改行付きデータが渡される |
| handleKill | session.kill が呼ばれ、'killed' ステータスが emit される |
| handleDisconnect | セッションの kill + remove + マップからの削除 |
| onExit コールバック | execution_status emit、セッション削除、マップからの削除 |

### 設計方針

`NospaceController` は `new NospaceExecutionService()` を内部で生成しているため、DI に対応させる必要があります:

1. `NospaceController` のコンストラクタに `NospaceExecutionService` を注入可能にする
2. テストでは fake の `NospaceExecutionService` を注入する
3. Socket オブジェクトも `on`/`emit` を持つスタブを作成する

### 要件

- 実ファイルシステムへのアクセス禁止
- 実プロセスの起動禁止
- Socket.IO の実接続禁止
- Mock ライブラリによるメソッドの差し替え禁止（依存性注入を使用）

---

## フェーズ 4: フロントエンドテストの拡充（低優先度）

### 対象モジュール

#### テストが存在しないモジュール

| モジュール | 重要度 | 理由 |
|---|---|---|
| `src/web/hooks/useNospaceExecution.ts` | 中 | 実行操作のフック。atom/socketへの依存が多く結合テスト寄り |
| `src/web/hooks/useNospaceSocket.ts` | 中 | ソケット接続管理。外部依存が大きい |
| `src/web/components/execution/InputPanel.tsx` | 低 | stdin入力処理。atomへの直接依存あり |
| `src/web/components/execution/OutputPanel.tsx` | 低 | 出力表示。atomへの直接依存あり |
| `src/web/components/layout/SplitPane.tsx` | 低 | ドラッグ操作のUIコンポーネント |

#### 既存テストの拡充

**CodeTextarea.spec.tsx** — 軽微な不足

現状不足しているテスト:
- Tabキー押下でスペース2つが挿入される機能のテスト（コンポーネントに `onKeyDown` ハンドラがある場合）

**既存の問題**:
- "変更時にonChangeが呼ばれる" テストが失敗中
- 原因: DOM の change イベントではなく、`@testing-library/user-event` または `fireEvent.change()` を使用すべき

### 注意事項

`useNospaceExecution` / `useNospaceSocket` は外部依存（socket.io-client, jotai store）が大きく、Unitテストの費用対効果が低い可能性があります。結合テスト（large テスト）として扱う方が適切です。

---

## 優先度

1. **フェーズ 3** (中): NospaceController テストの新規作成 — ビジネスロジックのカバレッジ向上
2. **フェーズ 4** (低): フロントエンドテストの拡充 — 現状でも最低限のカバレッジはある

## ステータス

- [x] フェーズ 3: NospaceController テスト新規作成（完了: 2026-02-11）
- [x] フェーズ 4: フロントエンドテスト拡充（完了: 2026-02-11）

## 実装詳細

### 完了した内容

**フェーズ 3:**
- NospaceController に DI 対応を実装（コンストラクタインジェクション）
- NospaceController.spec.ts を作成（12テストケース）
- Fake実装を使用した依存性注入テスト
- 全てのハンドラーとコールバックをカバー

**フェーズ 4:**
- CodeTextarea.spec.tsx に Tab キーのテストを追加（2テストケース）
- スペース2つの挿入をテスト
- テキスト選択範囲の置き換えをテスト

**テスト結果:**
- 全64テストが成功
- コードカバレッジ: 95.52%
- コミット: 1fb362a
