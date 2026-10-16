# 01. requestId による実行リクエストとイベントの対応付け

旧セッションのイベントが新しい実行に混入する問題を、クライアント生成の requestId で解消し、サーバ側のセッション登録を保護する。

作成日: 2026-10-16
ステータス: 設計完了（未実装）
元指摘: [08-session-id-mismatch.md](../code-review-2026-10-16/08-session-id-mismatch.md)

## 設計・方針

### 現状の問題（要約）

- サーバ: 旧セッションの `onExit` が `sessionsBySocket.delete(socket.id)` を無条件実行し、新セッションの登録を消す
- クライアント: イベントを sessionId で照合せず、旧セッションの `killed` / 遅延 stdout が新しい実行に反映される
- サーバ: `nospace_kill` / `nospace_stdin` がセッションの所有者を確認しない
- サーバ: `handleKill` の即時 `killed` emit と `onExit` の emit で `[Process killed]` が二重表示される
- サーバ: コントローラーのコールバックが `run()` / `compile()` の戻り値 `session` を参照しており、同期 `onExit` で TDZ 例外（元指摘 01）

### 方式の比較

| 方式 | 内容 | 長所 | 短所 |
|---|---|---|---|
| A. requestId（採用） | クライアントが run/compile ごとに ID を発行し、サーバが全イベントに付与 | イベント順序に依存しない。セッション生成前の拒否応答も対応付けられる | プロトコル変更（サーバ・クライアント同時デプロイ前提。同一リポジトリのため問題なし） |
| B. sessionId ロック | クライアントが run 後に最初に届いた未知の sessionId をロック | クライアントのみの変更 | stderr が status より先に届く経路や、拒否応答（sessionId なし）を正しく扱えない |

### プロトコル変更（`src/interfaces/NospaceTypes.ts`）

```ts
// Client -> Server
nospace_run: (payload: { requestId: string; code: string; options: RunOptions; stdinData?: string }) => void;
nospace_compile: (payload: { requestId: string; code: string; options: CompileOptions }) => void;
// nospace_stdin / nospace_kill は従来通り sessionId を使う

// Server -> Client（全イベントに requestId を追加）
nospace_stdout: (payload: { requestId: string; sessionId: string; data: string }) => void;
nospace_stderr: (payload: { requestId: string; sessionId: string; data: string }) => void;
nospace_execution_status: (payload: {
  requestId: string; sessionId: string; status: ExecutionStatus; exitCode?: number | null;
}) => void;
```

`requestId` の検証（サーバ）: `typeof === 'string'` かつ 1〜64 文字。不正なら当該イベントを無視する（例外を出さない）。

### サーバ側（`NospaceController` / `NospaceExecutionService`）

1. **コールバックが戻り値に依存しない形にする**（元指摘 01 の TDZ 解消を兼ねる）
   - `SessionCallbacks` の各コールバックに `sessionId` を渡す: `onStdout(sessionId, data)`, `onStderr(sessionId, data)`, `onExit(sessionId, status, exitCode)`
   - `status` も引数で渡し、コールバック内で `session.status` を参照しない
   - サービスは `sessions.set()` をコールバック呼び出しより**前**に行う（同期エラー経路での Map リーク解消）
   - これにより `handleCompile` の `let sessionId = ''` の回避策は不要になり削除する
2. **セッション登録の保護**
   - socket↔session の対応管理を `SocketSessionRegistry` クラスに切り出す（SRP と単体テスト容易性のため）。エントリは `{ sessionId, requestId }` を保持する
     ```ts
     /** ソケットごとの実行中セッション（と起因 requestId）を管理する */
     export class SocketSessionRegistry {
       set(socketId: string, entry: { sessionId: string; requestId: string }): void;
       get(socketId: string): { sessionId: string; requestId: string } | undefined;
       /** 登録中の sessionId が一致する場合のみ削除する */
       deleteIfMatch(socketId: string, sessionId: string): void;
       isOwner(socketId: string, sessionId: string): boolean;
     }
     ```
   - `onExit` 内は `registry.deleteIfMatch(socket.id, sessionId)`
   - `handleDisconnect` / `handleRun` の旧セッション kill も `registry.get()` を使う
3. **所有者確認**: `handleKill` / `handleStdinInput` は `registry.isOwner(socket.id, sessionId)` が false なら無視
4. **初期 status の emit 順序と登録**: コールバックが同期で呼ばれうるため、sessionId 確定（`run()` の戻り）前に登録・emit はできない。そこで `run()` / `compile()` が返った時点でセッションが既に終了済み（`status !== 'running'`）なら、**`registry.set` も初期 status（`running` / `compiling`）の emit も行わない**（終了済み ID が registry に残るのを防ぐ）
5. **`handleKill` の即時 `killed` emit は残す**（SIGTERM を無視するプロセスでも UI を即時復帰させるため。元指摘 02 (c) 未修正の間は特に必要）。付与する `requestId` は `registry.get(socket.id)` のエントリから取る。重複はクライアント側の「終端ステータス以降は無視」で吸収する
6. **例外をハンドラ外に出さない**
   - `spawnSession` の一時ファイル書き込み失敗時は `throw` せず、バイナリ未検出時と同様にエラーセッションを返す（`onStderr` → `onExit` の順で通知）
   - `handleConnection` で登録する全ハンドラを共通ラッパー `safeHandler(event, fn)` で包み、payload の参照（`payload.code` 等）を含むハンドラ全体を try/catch する。捕捉した例外はログ出力し、run / compile では requestId が取得できていれば requestId 付きの `nospace_stderr` と `error` status を emit する（共通ヘルパー `emitRequestError(socket, requestId, message)` を用意し、04 の上限拒否でも使う）
   - socket.io はハンドラを `process.nextTick` から呼ぶため、ここで漏れた例外はプロセス停止に直結する（元指摘 01）

### クライアント側（`ServerExecutionBackend` / `NospaceSocketClient` / `useNospaceExecution`）

1. `ServerExecutionBackend` に以下の状態を持つ
   ```ts
   private activeRequestId: string | null = null;
   private activeTerminated = false;  // 終端ステータス受信済み
   private currentSessionId: string | null = null;
   ```
2. `run()` / `compile()`: `activeRequestId = idGenerator()`、`activeTerminated = false`、`currentSessionId = null` にしてから emit
3. 受信時フィルタ（stdout / stderr / status 共通）
   - `payload.requestId !== activeRequestId` → 破棄
   - `activeTerminated` → 破棄
   - `currentSessionId === null` なら `payload.sessionId` を採用
   - status が `finished` / `error` / `killed` なら `activeTerminated = true`
4. ID 生成器はコンストラクタで DI する
   ```ts
   export type RequestIdGenerator = () => string;
   // 既定: `${Date.now().toString(36)}-${counter++}-${Math.random().toString(36).slice(2, 8)}`
   ```
   `crypto.randomUUID` は HTTP 公開時に使えないため既定実装では使わない（元指摘 07 (c) と同じ理由）
5. **楽観的ステータス更新**（連打防止）: `useNospaceExecution.handleRun` / `handleRunCompileOutput` は `backend.run()` 呼び出し直前に `executionStatusAtom` を `'running'`、`handleCompile` は `'compiling'` に設定する。WASM backend は `run()` 内で同期的に `running` を通知するため挙動は変わらない
   - `backend.run()` / `compile()` が同期 throw した場合（未接続時の `requireSocket()` 等）は catch して `executionStatusAtom` を `'error'` に戻し、システムメッセージを出力する
6. **sessionId 確定前の kill / stdin**: 楽観的更新により、サーバの最初のイベント到着前に Stop / stdin 送信が可能になる。`ServerExecutionBackend` は以下を持つ
   - `pendingKill: boolean` — `currentSessionId === null` かつ実行中リクエストありで `kill()` が呼ばれたら true にする
   - `pendingStdin: string[]` — 同条件の `sendStdin()` をキューに積む
   - sessionId 採用時に、`pendingKill` なら `emitKill`（stdin キューは破棄）、そうでなければキューを順に `emitStdin` して空にする
   - `run()` / `compile()` 開始時と終端ステータス受信時にクリアする
7. `NospaceSocketEventHandlers` の payload 型に `requestId` を追加

### WASM backend

プロトコル変更の影響はない。ただし `run()` 中の再 `run()` による旧ループのイベント混入（元指摘 07 (b)）は本タスク対象外。

## タスクステップ・チェックリスト

1. [ ] interfaces: payload 型に `requestId` を追加
2. [ ] サーバ
   1. [ ] `SessionCallbacks` を `sessionId` / `status` 引数付きに変更し、`sessions.set` をコールバック前に移動
   2. [ ] `SocketSessionRegistry` を新設し、Controller から利用
   3. [ ] onExit の条件付き削除、kill/stdin の所有者確認
   4. [ ] 全 emit に `requestId` を付与、`requestId` の検証
   5. [ ] 終了済みセッションに対する登録・初期ステータス emit の抑止
   6. [ ] 一時ファイル書き込み失敗をエラーセッション化、Controller の try/catch と `emitRequestError`
3. [ ] クライアント
   1. [ ] `ServerExecutionBackend` に requestId フィルタと終端ステータス管理を実装（ID 生成器 DI）
   2. [ ] `pendingKill` / `pendingStdin` の実装
   3. [ ] `useNospaceExecution` に楽観的ステータス更新と同期例外時の復帰を追加
4. [ ] テスト（下記）

### テスト

AGENTS.md に従い、バグ修正の原因となったケースを追加する。フェイク（DI）を用い `jest.mock` は使わない。

| 対象 | ケース |
|---|---|
| `NospaceController.spec` | 実行 A 中に B を開始 → A の onExit 後も B が registry に残り、disconnect で B が kill される |
| `NospaceController.spec` | フェイクサービスが `onExit` を**同期的に**呼ぶ場合に例外が出ず、`running` を emit せず、registry に登録されない |
| `NospaceController.spec` | フェイクサービスが例外を throw してもハンドラ外に例外が出ず、requestId 付き `error` status が emit される |
| `NospaceController.spec` | kill 時の即時 `killed` に registry の requestId が付与される |
| `NospaceExecutionService.spec` | `writeFileSync` が throw してもサービスが throw せず、エラーセッションを返す |
| `ServerExecutionBackend.spec` | running 受信前の kill が sessionId 確定時に送信される / stdin キューが順に送信される |
| `useNospaceExecution.spec` | `backend.run()` が throw したとき status が `error` に戻る |
| `NospaceController.spec` | 他ソケットのセッション ID で kill/stdin → 無視される |
| `NospaceController.spec` | `requestId` 欠落・非文字列の payload → 例外なく無視される |
| `NospaceExecutionService.spec` | 未サポート target / バイナリ未検出時、`onExit` 呼び出し時点でセッションが Map に存在し、`removeSession` 後に残らない |
| `SocketSessionRegistry.spec`（新規） | `deleteIfMatch` が不一致時に削除しない / `get` が requestId を返す |
| `ServerExecutionBackend.spec` | 旧 requestId の stdout/status が破棄される / 終端ステータス後の重複 `killed` が無視される |
| `useNospaceExecution.spec` | handleRun 直後に `isRunning` が true になる |

## 影響範囲

- `src/interfaces/NospaceTypes.ts`
- `src/app/Controllers/NospaceController.ts`、新規 `src/app/Controllers/SocketSessionRegistry.ts`（配置は Controllers 配下とする）
- `src/app/Services/NospaceExecutionService.ts`（`SessionCallbacks` シグネチャ）
- `src/web/services/ServerExecutionBackend.ts`, `NospaceSocketClient.ts`, `src/web/hooks/useNospaceExecution.ts`
- テスト: 上表のファイル
