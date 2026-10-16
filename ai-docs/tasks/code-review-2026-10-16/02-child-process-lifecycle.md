# 02. 子プロセスのライフサイクル管理の不備

- 重要度: **high**（(a)(b) はサーバ停止に直結。(c)〜(e) は medium 相当）
- 対象: `src/app/Services/NospaceExecutionService.ts`, `src/app/Controllers/NospaceController.ts`, `src/app/MainServer.ts`

## 問題点

### (a) ChildProcess の `error` イベント未処理（high）

`NospaceExecutionService.ts:85-107` で ChildProcess に `'error'` リスナーがない。
バイナリ存在確認は `existsSync` のみで、実行権限なし（EACCES）やプロセス数上限（EAGAIN）で spawn が失敗すると未処理 `error` で**プロセスが終了する**（EACCES で再現済み）。
`close` が来ない可能性があり、一時ファイル・タイマーの後始末も保証されない。

### (b) stdin の EPIPE 未処理（high）

`NospaceExecutionService.ts:142-146` で `process.stdin` の `'error'` 未処理。
batch モードで大きな `stdinData`（最大約 1MB）を即終了するプログラムに書き込むと EPIPE → 未処理 `error` でサーバ停止（`/bin/true` に 1MB 書き込みで再現済み）。
`NospaceController.ts:168` の `status === 'running'` チェックは `close` までは running のため防げない。

攻撃シナリオ: 入力を読まずに終了するコード + 大きな stdinData を batch で送信。

### (c) SIGKILL フォールバックが発火しない（medium）

`NospaceExecutionService.ts:128-140`（`:111` も同様）。`ChildProcess.killed` は「シグナル送信成功」で true になり、終了を意味しない。
SIGTERM 直後に true となるため 2 秒後の `!this.process.killed` は常に false で SIGKILL が送られない。SIGTERM を無視するプロセスが残留する。
また終了済みセッションへの kill で status が `'killed'` に書き換わる。

### (d) batch モードで stdin を閉じない（medium）

`NospaceController.ts:93-98` はコメントで「close しない」と明記。入力を EOF まで読むプログラムはタイムアウト（30 秒）まで待ち続け、機能不具合かつ無駄なプロセス占有となる。

### (e) サーバ終了時の後始末なし（medium）

`MainServer.ts:15-18` は SIGINT で `process.exit(0)` のみ、SIGTERM ハンドラなし（docker stop / systemd）。
親終了でタイムアウト管理タイマーも消え、無限ループ中の子プロセスが孤児として残る可能性。`./tmp/nospace-*.ns` も残る。

## 違反しているルール・原則

- フェイルセーフ設計、リソースの確実な解放
- Node.js の EventEmitter における `error` イベント処理の原則

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | `process.on('error')` でセッションを error 状態にし、cleanup と `onExit` を**一度だけ**呼ぶ（冪等化フラグ） | `SessionImpl`、テスト（フェイク spawner に error 発火機能を追加） |
| 2 | `process.stdin.on('error')` を登録し EPIPE を無視/ログ | `SessionImpl` |
| 3 | kill 判定を `exitCode === null && signalCode === null` または close 受信フラグに変更。フォールバックタイマーを保持し cleanup で clear。終了済みなら status を書き換えない | `SessionImpl` |
| 4 | `NospaceSession` に `closeStdin()` を追加し、batch モードで書き込み後に `stdin.end()` | Session IF、`NospaceController`、テスト |
| 5 | `ExecutionService.killAll()` を追加し、SIGINT/SIGTERM で全セッション kill → `httpServer.close()` → exit | `MainServer.ts`, `NospaceExecutionService` |
| 6 | 補助策: `existsSync` を `fs.accessSync(path, X_OK)` に変更 | `NospaceExecutionService` |
