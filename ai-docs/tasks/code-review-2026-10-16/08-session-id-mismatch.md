# 08. 旧セッションのイベント・後始末が新セッションに干渉する

- 重要度: **medium**
- 対象: `src/app/Controllers/NospaceController.ts`, `src/web/services/ServerExecutionBackend.ts`, `src/web/hooks/useExecutionBackend.ts`

サーバ・クライアント双方のレビューで独立に指摘された問題。

## 問題点

### (a) サーバ: 旧セッションの onExit が新セッションの登録を消す

`NospaceController.ts:47-56`, `:78-79`, `:144-145`。実行 A 中に実行 B を開始すると A を kill し B を `sessionsBySocket` に登録する。
その後 A の `close` で `onExit` が `this.sessionsBySocket.delete(socket.id)` を**無条件に**実行し B の登録を消す。
この状態で切断すると `handleDisconnect` が B を見つけられず、B はタイムアウトまで残る（03 と組み合わせるとプロセス取りこぼし）。

### (b) クライアント: sessionId でイベントをフィルタしていない

`ServerExecutionBackend.ts:59-93`, `useExecutionBackend.ts:84-110`。stdout / stderr / status を sessionId で照合せず、`currentSessionId` は届いた status で無条件に上書きされる。

- 旧セッションの `killed` / `finished` が新セッションの `running` より後に届くと status が `finished` になり、新プロセスが動いているのに Stop が無効、`currentSessionId` も旧 ID に戻る
- 遅延した旧出力が新しい実行の出力（compile 中なら compiled output）に混入
- websocket では `running` が非同期に届くまで `isRunning=false` のため、Run 連打で二重送信できる
- サーバの `handleKill` が `killed` を即時 emit し `onExit` でも emit するため `[Process killed]` が二重表示される

### (c) サーバ: kill / stdin でセッション所有者を確認していない（low）

`NospaceController.ts:162-185`。`nospace_kill` / `nospace_stdin` はソケットとセッションの所有関係を確認しない。ID は UUIDv4 で他者に送信されないため悪用は困難だが、多層防御として確認すべき。

## 違反しているルール・原則

- 競合状態への耐性（非同期イベント順序を前提にしない）
- 認可（リソース所有者の確認）

## 解決策

| # | 方針 | 影響範囲 |
|---|---|---|
| 1 | サーバ: 削除前に `sessionsBySocket.get(socket.id) === sessionId` を確認。kill / stdin も同様に所有確認 | `NospaceController` の数か所、テスト |
| 2 | サーバ: socket↔session 管理を専用クラスに切り出す（SRP） | `NospaceController`, 新規クラス |
| 3 | クライアント: 発行したリクエスト ID を payload に含め、一致しないイベントを破棄 | `src/interfaces`, サーバ, クライアント |
| 4 | クライアント最小対策: 最初の `running` / `compiling` で sessionId をロックし、次の `run()` まで他 ID のイベントを無視 | `ServerExecutionBackend` のみ |
| 5 | `handleRun` 呼び出し時にクライアント status を楽観的に `running` にして連打を防止 | `useNospaceExecution` |
| 6 | `handleKill` の即時 `killed` emit を削除、またはクライアントで重複除去 | `NospaceController` または `ServerExecutionBackend` |
