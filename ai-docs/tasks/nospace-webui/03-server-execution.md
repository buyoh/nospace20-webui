# サーバーサイド実行サービス設計

## 概要

サーバー上で nospace20 インタプリタの外部プロセスを起動し、
Socket.IO 経由でクライアントと stdin/stdout/stderr をストリーミングする。

本ドキュメントではインタプリタ（実行）のみを扱い、コンパイル機能は対象外とする。

## NospaceExecutionService

### インターフェース

```typescript
// src/app/Services/NospaceExecutionService.ts

export interface NospaceSession {
  readonly sessionId: string;
  readonly status: 'running' | 'finished' | 'error' | 'killed';
  readonly exitCode: number | null;
  kill(): void;
  sendStdin(data: string): void;
}

export interface NospaceExecutionService {
  /**
   * ソースコードを実行する。
   * プロセスの stdin/stdout/stderr をストリーミング。
   * セッションオブジェクトを返し、kill や stdin 送信に使う。
   */
  run(
    code: string,
    options: RunOptions,
    callbacks: {
      onStdout: (data: string) => void;
      onStderr: (data: string) => void;
      onExit: (code: number | null) => void;
    }
  ): NospaceSession;

  /**
   * 実行中のセッションを取得（存在しない場合は undefined）
   */
  getSession(sessionId: string): NospaceSession | undefined;
}
```

### 型定義

```typescript
// src/interfaces/NospaceTypes.ts

export type LanguageSubset = 'standard' | 'min' | 'ws';

export interface RunOptions {
  /** 言語サブセット */
  language: LanguageSubset;
  /** デバッグトレースを有効化 */
  debug: boolean;
  /** デバッグ組み込み関数を無効化 */
  ignoreDebug: boolean;
  /** 標準入力モード */
  inputMode: 'interactive' | 'batch';
}
```

### 実装詳細

#### プロセス実行

Node.js の `child_process.spawn` を使用。

**実行時のコマンド:**
```bash
<NOSPACE_BIN_PATH> --std <language> [-d] [--ignore-debug] <file>
```

- `<NOSPACE_BIN_PATH>` は `.env.local` の `NOSPACE_BIN_PATH` で設定された値を使用する（`Config.nospaceBinPath` 経由、詳細は [05-env-config.md](05-env-config.md)）
- `--mode run` はデフォルト値のため省略可

#### ソースコード受け渡し

- ソースコードは一時ファイルに書き出し、nospace20 にファイルパスとして渡す
- 一時ファイルは `./tmp/` ディレクトリに作成（プロジェクトルール準拠）
- ファイル名は `nospace-<sessionId>.ns` のようにセッション ID を含める
- プロセス終了後に一時ファイルを削除

#### nospace20 の CLI 引数

`components/nospace20/nospace20-help.txt` に基づく。

```
nospace20 [OPTIONS] [FILE]
```

実行時に使用するオプション:
- `--std <standard|min|ws>`: 言語サブセット（デフォルト: `standard`）
- `-d, --debug`: デバッグトレース有効化
- `--ignore-debug`: デバッグ組み込み関数（__assert, __assert_not, __trace, __clog）無効化

#### セッション管理

- 各クライアント（Socket）につき同時に 1 セッションのみ
- 新しい実行要求が来たら、既存セッションがあれば kill してから新規作成
- セッション ID は UUID v4 で生成（`crypto.randomUUID()` を使用）

#### エラーハンドリング

- nospace20 実行ファイルが見つからない場合: `status: 'error'` で通知し、stderr にエラーメッセージを送信
- プロセスタイムアウト: `Config.nospaceTimeout`（デフォルト 30 秒）で制御。超過時は SIGTERM → SIGKILL
- プロセス異常終了: exit code と stderr をクライアントに通知

## NospaceController

### インターフェース

```typescript
// src/app/Controllers/NospaceController.ts

export interface NospaceController {
  /**
   * ソースコードを実行する。
   * stdout/stderr はコールバック経由で逐次クライアントに送信。
   */
  handleRun(
    code: string,
    options: RunOptions,
    stdinData: string | undefined,
    emit: EmitFunction
  ): void;

  /**
   * 実行中プロセスの stdin に入力を送信（interactive モード）。
   */
  handleStdinInput(
    sessionId: string,
    data: string
  ): void;

  /**
   * 実行中プロセスを SIGTERM で停止。
   */
  handleKill(sessionId: string): void;

  /**
   * クライアント切断時に実行中セッションをクリーンアップ。
   */
  handleDisconnect(): void;
}
```

### EmitFunction 型

```typescript
type EmitFunction = {
  stdout: (sessionId: string, data: string) => void;
  stderr: (sessionId: string, data: string) => void;
  executionStatus: (sessionId: string, status: ExecutionStatus, exitCode?: number | null) => void;
};
```

### ライフサイクル

1. クライアント接続 → Socket ごとに NospaceController を生成
2. `nospace_run` → `handleRun` → stdout/stderr を逐次 emit
3. `nospace_stdin` → `handleStdinInput` → プロセスの stdin に書き込み
4. `nospace_kill` → `handleKill` → プロセスを SIGTERM で停止
5. クライアント切断 → `handleDisconnect` → 実行中セッションがあれば kill

### batch モード時の stdin 処理

`handleRun` に `stdinData` が渡された場合（batch モード）:
1. プロセス起動
2. `stdinData` を `process.stdin.write()` で書き込み
3. `process.stdin.end()` で EOF を送信

## 設定値の取得

nospace20 バイナリのパスは `Config.nospaceBinPath` から取得する。
この値は `.env.local`（または `.env.example`）の `NOSPACE_BIN_PATH` で設定される。

```typescript
// Config.ts から参照
import Config from '../Config';

const binPath = Config.nospaceBinPath;
```

詳細は [05-env-config.md](05-env-config.md) を参照。

## セキュリティ考慮

- 同時実行プロセス数の上限制御（`Config.nospaceMaxProcesses`）
- プロセスタイムアウト設定（`Config.nospaceTimeout`）
- 入力サイズの制限（ソースコード・stdin）
- nospace20 バイナリパスはサーバー設定（`.env.local`）で管理し、クライアントからの指定不可
