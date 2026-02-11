# サーバーサイド実行サービス設計

## 概要

サーバー上で nospace20 コンパイラ/インタプリタの外部プロセスを起動し、
Socket.IO 経由でクライアントと stdin/stdout/stderr をストリーミングする。

## NospaceExecutionService

### インターフェース

```typescript
// src/app/Services/NospaceExecutionService.ts

export interface NospaceSession {
  readonly sessionId: string;
  readonly status: 'compiling' | 'running' | 'finished' | 'error' | 'killed';
  readonly exitCode: number | null;
  kill(): void;
  sendStdin(data: string): void;
}

export interface NospaceExecutionService {
  /**
   * ソースコードをコンパイルし、結果を返す。
   * コンパイルが完了するまで Promise で待機。
   */
  compile(
    code: string,
    options: CompileOptions,
    callbacks: {
      onStderr: (data: string) => void;
    }
  ): Promise<CompileResult>;

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

export interface CompileOptions {
  language: 'standard' | 'min' | 'ws';
  target: 'ws' | 'mnemonic' | 'ex-ws' | 'json';
}

export interface ExecutionOptions {
  debug: boolean;
  ignoreDebug: boolean;
  inputMode: 'interactive' | 'batch';
}

export type RunOptions = CompileOptions & ExecutionOptions;

export interface CompileResult {
  success: boolean;
  output: string;    // コンパイル成果物
  errors: string;    // stderr 出力
  exitCode: number;
}
```

### 実装詳細

#### プロセス実行

Node.js の `child_process.spawn` を使用。

**コンパイル時のコマンド:**
```bash
nospace20 compile --language <lang> --target <target> < input_file
```

**実行時のコマンド:**
```bash
nospace20 run --language <lang> [--debug] [--ignore-debug] < input_file
```

#### ソースコード受け渡し

- ソースコードは一時ファイルに書き出し、nospace20 にファイルパスとして渡す
- 一時ファイルは `./tmp/` ディレクトリに作成（プロジェクトルール準拠）
- プロセス終了後に一時ファイルを削除

#### nospace20 の CLI 引数

`components/nospace20/nospace20-help.txt` を参考にする。

```
nospace20 run [options] <file>
nospace20 compile [options] <file>
```

主なオプション:
- `--language <standard|min|ws>`: 言語サブセット
- `--target <ws|mnemonic|ex-ws|json>`: コンパイルターゲット
- `--debug`: デバッグトレース有効化
- `--ignore-debug`: デバッグ組み込み関数無効化

#### セッション管理

- 各クライアント（Socket）につき同時に 1 セッションのみ
- 新しい実行要求が来たら、既存セッションがあれば kill してから新規作成
- セッション ID は UUID v4 で生成（`crypto.randomUUID()` を使用）

#### エラーハンドリング

- nospace20 実行ファイルが見つからない場合: エラーを返す
- プロセスタイムアウト: 設定可能（デフォルト 30 秒）
- プロセス異常終了: exit code と stderr をクライアントに通知

## NospaceController

### インターフェース

```typescript
// src/app/Controllers/NospaceController.ts

export interface NospaceController {
  handleCompile(
    code: string,
    options: CompileOptions,
    emit: EmitFunction
  ): Promise<void>;

  handleRun(
    code: string,
    options: RunOptions,
    emit: EmitFunction
  ): void;

  handleStdinInput(
    sessionId: string,
    data: string
  ): void;

  handleKill(sessionId: string): void;
}
```

### ライフサイクル

1. クライアント接続 → Socket ごとに session 管理を割り当て
2. `compile_request` → `handleCompile` → 結果を `compile_result` で返す
3. `run_request` → `handleRun` → stdout/stderr を逐次 emit
4. `stdin_input` → `handleStdinInput` → プロセスの stdin に書き込み
5. `kill_request` → `handleKill` → プロセスを SIGTERM で停止
6. クライアント切断 → 実行中セッションがあれば kill

## セキュリティ考慮

- 同時実行プロセス数の上限制御（サーバーリソース保護）
- プロセスタイムアウト設定
- 入力サイズの制限（ソースコード・stdin）
- nospace20 バイナリパスはサーバー設定でハードコーディング（ユーザー指定不可）
