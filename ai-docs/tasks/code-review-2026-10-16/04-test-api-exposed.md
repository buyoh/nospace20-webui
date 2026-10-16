# 04. テストファイル書き込み API が本番でも認証なしで公開されている

- 重要度: **high**（外部公開する場合）
- 対象: `src/app/Web/Express.ts`, `src/app/Config.ts`, `src/app/Routes/TestRoutes.ts`, `src/app/Services/TestFileService.ts`, `src/app/Controllers/TestController.ts`, `src/web/services/TestApiClient.ts`

## 問題点

### (a) 認証なしの書き込み API（high）

`Express.ts:21-23` は `testDir` が truthy ならテスト API を登録するが、`Config.ts:39` に既定値 `'./resources/tests'` があるため**常に有効**。
本番（`npm run prod`）でも `PUT /api/tests/*`, `POST /api/tests` が公開され、誰でも `.ns` / `.check.json` を作成・上書き・削除（`check: ''`、`TestFileService.ts:107-111`）できる。
`mkdirSync({ recursive: true })`（`:136-138`）で任意深さのディレクトリ作成も可能。1 リクエスト 100KB を回数無制限で書き込めるためディスク枯渇も起こりうる。

CSRF については `Content-Type: application/json` 必須かつ CORS 未設定のため、クロスオリジンのフォーム送信は事実上防がれている。

### (b) TestFileService の入力・整合性（low）

- `source` / `check` の型未検証。非文字列だと `.ns` 書き込み後に `check` 書き込みで失敗し、中途半端な状態が残る（`:103-114`）
- async メソッド内で同期 fs を使用、大きなツリーで event loop をブロック
- パス検証が字句的（`resolve` + `relative`）なため、testDir 内のシンボリックリンク経由で外部に出られる（現状リポジトリにシンボリックリンクがなければ実害なし）
- `includes('..')` が `a..b` のような正当な名前も拒否

### (c) クライアントのパス未エンコード（low）

`TestApiClient.ts:34`, `:55` で `path` をそのまま URL に埋め込み、`#` `?` `%` を含む名前で壊れる。作成フォームのファイル名も未検証（`TestCaseCreateForm.tsx:38-41`）。

## 違反しているルール・原則

- 開発用機能を本番に公開しない
- 書き込み系エンドポイントの認証・認可
- 原子的な更新（部分書き込みを残さない）

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | `Config.develop` 時、または明示フラグ（例: `ENABLE_TEST_API=true`）時のみルート登録。既定は無効 | `Express.ts`, `Config.ts`, `EnvConfig.ts`, `.env.example`。クライアントは API 不在時にテストエディタタブを無効化する対応が必要 |
| 2 | 書き込み系にトークン認証、または localhost からのアクセスに限定 | `TestRoutes.ts`（ミドルウェア追加）、`TestApiClient` |
| 3 | 書き込みサイズ・件数の上限 / レート制限 | `TestRoutes.ts`, `TestFileService` |
| 4 | 型検証の追加、一時ファイル + rename による原子的更新、`fs.promises` + `realpath` による検証 | `TestFileService`, テスト（フェイク fs に rename / realpath を追加） |
| 5 | クライアントでセグメントごとに `encodeURIComponent`、ファイル名を `[A-Za-z0-9_-]+` で検証 | `TestApiClient`, `TestCaseCreateForm` |
