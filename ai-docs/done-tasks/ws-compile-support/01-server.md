# サーバーサイド設計

## NospaceTypes.ts — Socket.IO イベント型

### `NospaceClientToServerEvents` に追加

```typescript
/** Compile request */
nospace_compile: (payload: {
  code: string;
  options: CompileOptions;
}) => void;
```

`CompileOptions` は既存の型をそのまま使用する:

```typescript
interface CompileOptions {
  language: LanguageSubset;
  target: CompileTarget;
}
```

`NospaceServerToClientEvents` は変更不要。コンパイル結果は既存の `nospace_stdout` / `nospace_stderr` / `nospace_execution_status` で返す。

## NospaceExecutionService.ts — compile メソッド

### 新規メソッド: `compile()`

```typescript
compile(
  code: string,
  options: CompileOptions,
  callbacks: SessionCallbacks,
): NospaceSession
```

処理フロー:

1. `randomUUID()` でセッション ID 生成
2. `./tmp/nospace-${sessionId}.ns` に一時ファイル作成
3. コマンドライン引数を構築:
   - `--mode compile`
   - `--std <options.language>`
   - `--target <options.target>`
   - `<tempFilePath>`
4. `nospace20` バイナリを `spawn` で起動
5. `NospaceSessionImpl` を生成して返却

### 引数の構築

```typescript
const args: string[] = [];
args.push('--mode', 'compile');
args.push('--std', options.language);
args.push('--target', options.target);
args.push(tempFilePath);
```

### 既存の `run()` メソッドとの共通化

`run()` と `compile()` は以下のロジックが共通:

- 一時ファイル作成
- バイナリ存在チェック
- プロセス spawn + NospaceSessionImpl 生成
- セッション登録

共通部分をプライベートメソッド `spawnSession()` に抽出する:

```typescript
private spawnSession(
  code: string,
  args: string[],
  callbacks: SessionCallbacks,
): NospaceSession
```

`run()` と `compile()` はそれぞれ引数を構築し、`spawnSession()` を呼び出す。

### CompileTarget バリデーション

CLI がサポートするターゲットは `ws` / `mnemonic` / `json` のみ。`ex-ws` は WASM 専用。
サーバー側でバリデーションを行い、不正なターゲットの場合はエラーセッションを返す。

```typescript
private static readonly SUPPORTED_COMPILE_TARGETS = new Set(['ws', 'mnemonic', 'json']);

compile(code: string, options: CompileOptions, callbacks: SessionCallbacks): NospaceSession {
  if (!NospaceExecutionService.SUPPORTED_COMPILE_TARGETS.has(options.target)) {
    // エラーセッション返却（run() の binary not found と同パターン）
  }
  // ...
}
```

## NospaceController.ts — nospace_compile ハンドラ

### イベントハンドラ追加

`handleConnection()` に `nospace_compile` リスナーを追加:

```typescript
socket.on('nospace_compile', (payload) => {
  this.handleCompile(socket, payload.code, payload.options);
});
```

### handleCompile メソッド

```typescript
private handleCompile(
  socket: Socket,
  code: string,
  options: CompileOptions,
): void
```

処理フロー:

1. 既存セッション存在時は kill + remove
2. `executionService.compile(code, options, callbacks)` を呼び出し
3. コールバック設定（`run` と同じパターン）:
   - `onStdout` → `socket.emit('nospace_stdout', ...)`
   - `onStderr` → `socket.emit('nospace_stderr', ...)`
   - `onExit` → `socket.emit('nospace_execution_status', ...)` + セッション削除
4. セッション登録
5. 初回ステータス通知: **`'compiling'`** （`handleRun` の `session.status`（= `'running'`）との差分）

```typescript
// handleRun の場合:
socket.emit('nospace_execution_status', {
  sessionId: session.sessionId,
  status: session.status, // 'running'
  exitCode: session.exitCode,
});

// handleCompile の場合:
socket.emit('nospace_execution_status', {
  sessionId: session.sessionId,
  status: 'compiling', // 固定値
  exitCode: null,
});
```

### handleRun との共通化

`handleRun` と `handleCompile` は以下のロジックが共通:

- 既存セッション kill
- コールバック設定
- セッション登録

共通部分をプライベートメソッドに抽出できるが、差分（`compile` vs `run` の呼び分け、初回ステータス）があるため、過度な共通化は避ける。各メソッドは明示的に処理を記述する。

## テスト

### NospaceExecutionService.spec.ts

追加テストケース:

| テスト | 内容 |
|---|---|
| `compile で正しいコマンドライン引数を構築する` | `--mode compile --std standard --target ws` 等の引数検証 |
| `compile で一時ファイルを作成する` | 書き込みファイル名に `nospace-` プレフィクス |
| `compile でコンパイル成功時に stdout を通知する` | stdout コールバック呼び出し |
| `compile でコンパイルエラー時に stderr を通知する` | stderr コールバック呼び出し |
| `compile でプロセス終了時にコールバックを呼び出す` | onExit コールバック |
| `compile でサポート外ターゲットをエラーにする` | `ex-ws` 指定時にエラーセッション返却 |
| `compile でバイナリ未存在時にエラーを返す` | 既存の run のテストと同パターン |

### NospaceController.spec.ts

追加テストケース:

| テスト | 内容 |
|---|---|
| `nospace_compile イベントで compile を呼ぶ` | `executionService.compile()` 呼び出し検証 |
| `compile の初回ステータスが compiling である` | `nospace_execution_status` の status 確認 |
| `compile 中に disconnect で kill される` | 既存の run disconnect テストと同パターン |
| `compile 中に新しい compile リクエストで既存セッションが kill される` | セッション上書きの検証 |
