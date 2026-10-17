# 11. CI のサプライチェーン・権限リスクと依存の不整合

- 重要度: **medium**
- 対象: `.github/workflows/fmt.yml`, `.github/workflows/test.yml`, `package.json`

## 問題点

### (a) CI

- `fmt.yml` の `ad-m/github-push-action@master` がタグ/SHA 固定されておらず、`contents: write` 権限で実行される
- `npm ci` の lifecycle スクリプトも書き込み権限付きトークン下で実行される
- `pull_request` イベントでも自動コミット・push を試みる（push 先が意図通りかは未確認）
- `test.yml` は `actions/checkout@v2`（非推奨）のままで、型チェック・ビルドを実行していない

### (b) 依存の型・バージョン不整合（low）

- `express@^4.22.1` に `@types/express@^5`
- `jest@^30` に `ts-jest@^29`（peer 範囲外の可能性）

## 違反しているルール・原則

- サプライチェーンセキュリティ（外部アクションの固定、最小権限）
- 型定義と実装バージョンの一致

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | 外部アクションをコミット SHA で固定、`actions/checkout` を最新メジャーへ | workflow ファイルのみ |
| 2 | fmt を push イベントのみに限定、または自動コミットをやめ `npm run lint` で失敗させる方式に変更 | `fmt.yml`、開発フロー |
| 3 | `npm ci --ignore-scripts` を使用 | workflow（ビルドに必要な postinstall がないか確認要） |
| 4 | `test.yml` に `tsc --noEmit` とビルドを追加 | `test.yml` |
| 5 | `@types/express@^4` に揃える、ts-jest を jest 30 対応版へ更新 | `package.json`, `package-lock.json`。型エラーが出る可能性 |

### 追加補足

- fmt.yamlを廃止し、`.github/disabled_workflows/fmt.yml` に移動したが、修正は行う。
- 動作確認しない。

## 対応状況（2026-10-17）

**完了**（動作確認はしない方針。依存のみローカルでテスト・型チェックを確認した）。`fmt.yml` は `.github/disabled_workflows/` へ移動済みだが、修正は反映した。

| 解決策 | 状態 | 内容 |
|---|---|---|
| 1 | 一部 | `actions/checkout` を v6 に更新（`fmt.yml` と同じ）。`ad-m/github-push-action` は `master` ではなくタグ（`v0.8.0`）で固定。**コミット SHA での固定は未実施**（ネットワーク上で SHA を検証できないため。有効化する際に SHA へ置き換えること） |
| 2 | 完了 | `fmt.yml` を push イベントのみに限定（`pull_request` では自動コミット・push しない） |
| 3 | 完了 | `npm ci --ignore-scripts`。package.json に `postinstall` / `prepare` 等の lifecycle スクリプトは無い |
| 4 | 一部 | `test.yml` に `npm run build`（サーバーの `tsc` と `vite build`）を追加。`tsc --noEmit -p tsconfig.json` は、既存のテストコードと ace のモード定義に型エラーがあるため追加していない |
| 5 | 完了 | `@types/express` を `^4.17.25` に、`ts-jest` を `^29.4.15`（jest 30 対応）に更新。`package-lock.json` も更新 |

- `test.yml` に `permissions: contents: read` と `persist-credentials: false` を追加（最小権限）
- 型エラーは発生せず（`tsc -p tsconfig.server.json`）、全テストが通ることを確認
