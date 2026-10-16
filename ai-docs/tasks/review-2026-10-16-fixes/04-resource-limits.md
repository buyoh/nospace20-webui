# 04. リソース上限（同時実行数・出力量）

サーバの同時実行プロセス数（全体・クライアント単位）と出力量、クライアントの出力蓄積量に上限を設け、DoS とメモリ枯渇を防ぐ。

作成日: 2026-10-16
ステータス: 設計完了（未実装）
元指摘: [03-resource-limits-dos.md](../code-review-2026-10-16/03-resource-limits-dos.md)
依存: [01](01-session-request-id.md)（requestId、`SocketSessionRegistry`、`emitRequestError`、`SessionCallbacks` の新シグネチャ）

## 設計・方針

### 現状の問題（要約）

- `NOSPACE_MAX_PROCESSES` は `Config` で読み込まれるが未使用。接続数無制限のため N ソケット × 30 秒の CPU 占有が可能
- 子プロセスの出力量に上限がなく、全 chunk を `socket.emit` する。chunk ごとの `data.toString()` で UTF-8 マルチバイト文字が分断される
- クライアントは出力を無制限に配列へ追加し DOM も増え続ける

### A. 同時実行数上限（サーバ）

#### 二段階の上限

| 上限 | 設定 | 既定 | 目的 |
|---|---|---|---|
| 全体 | `NOSPACE_MAX_PROCESSES`（既存） | 5 | ホスト資源の保護 |
| クライアント単位 | `NOSPACE_MAX_PROCESSES_PER_CLIENT`（新規） | 2 | 少数の接続で全利用者を締め出す可用性 DoS の緩和 |

- クライアントの識別子は `socket.handshake.address`（接続元 IP）。リバースプロキシ配下では全員が同一 IP になるため、その場合は `X-Forwarded-For` を信頼する設定が必要になるが、**本タスクでは対象外**（README / `.env.example` に注意書きを記載）
- クライアント単位の既定を 2 とするのは、同一ソケットの再実行時に「kill 済みで close 待ちの旧プロセス + 新プロセス」が一時的に共存するため
- **リスク（残存）**: 多数の IP を持つ攻撃者には全体上限で締め出されうる。完全な対策は認証・レート制限・インフラ側の制限が必要で、README の「対象外」に記載済み

#### `ExecutionSlotLimiter`（新規, `src/app/Services/ExecutionSlotLimiter.ts`）

```ts
/** 全体およびクライアント単位の同時実行プロセス数を制限するカウンタ */
export class ExecutionSlotLimiter {
  constructor(private readonly maxTotal: number, private readonly maxPerClient: number) {}
  /**
   * 空きがあれば確保して解放関数を返す。空きがなければ拒否理由を返す。
   * 返す解放関数は冪等（2 回目以降は no-op）
   */
  tryAcquire(clientKey: string): { release: () => void } | { rejected: 'total' | 'client' };
}
```

- `NospaceExecutionService` のコンストラクタで注入（既定は `new ExecutionSlotLimiter(config.nospaceMaxProcesses, config.nospaceMaxProcessesPerClient)`）
- `ExecutionConfig` に `nospaceMaxProcesses` / `nospaceMaxProcessesPerClient` / `nospaceMaxOutputBytes` を追加
- `run()` / `compile()` に `clientKey: string` 引数を追加
- `spawnSession` の**一時ファイル書き込み前**に `tryAcquire()`。拒否なら `ExecutionLimitError`（新規。`reason` を持つ）を throw する。コールバックは呼ばない
- 未サポート target の早期エラーはスロットを確保しない。バイナリ未検出・一時ファイル書き込み失敗はスロット確保後に検出されるため、その場で `release()` する

#### スロット解放と終了処理の一本化

`NospaceSessionImpl` の終了処理を冪等な `finalize(code)` にまとめ、**`close` と `error` の両イベントから呼ぶ**。

```ts
private finalized = false;
private finalize(code: number | null, status: SessionStatus): void {
  if (this.finalized) return;
  this.finalized = true;
  this._exitCode = code;
  if (this._status !== 'killed') this._status = status;
  this.cleanup();          // タイマー解除・一時ファイル削除
  this.releaseSlot();      // ExecutionSlotLimiter の解放関数
  this.callbacks.onExit(this.sessionId, this._status, code);
}
// process.on('close', (code) => this.finalize(code, code === 0 ? 'finished' : 'error'));
// process.on('error', (err) => { this.callbacks.onStderr(this.sessionId, `${err.message}\n`); this.finalize(null, 'error'); });
```

- spawn 失敗（EACCES / EAGAIN）では `close` が来ないことがあるため、`error` からの解放が必須。`error` リスナーの追加は元指摘 02 (a)（未処理 `error` によるサーバ停止）の解消も兼ねる
- `error` の後に `close` が来ても `finalized` により二重通知しない

> 注意: SIGKILL フォールバックが壊れている現状（元指摘 02 (c)）では、SIGTERM を無視するプロセスが close せずスロットを解放しない。02 (c) は本タスク対象外だが、本タスクの直後に対応すること。stdin の EPIPE（02 (b)）も本タスク対象外。

#### Controller の容量確認と拒否応答

- `handleRun` / `handleCompile` の順序は従来通りとする:
  1. 旧セッションを kill する（旧プロセスは close までスロットを占有）
  2. 新規実行を開始。`ExecutionLimitError` なら `emitRequestError(socket, requestId, message)`（01 で導入）で通知
- 「容量確認を旧セッション kill より前に行う」案は採らない。同一ソケットの再実行では旧プロセスの終了を待たずに新規を開始したい一方、旧スロットを新規へ引き継ぐ設計は close 前の旧プロセスを数えなくなり上限の意味が薄れるため。代わりにクライアント単位上限を 2 とする
- クライアント単位上限 2 により、通常の再実行（旧 1 + 新 1）は拒否されない。旧プロセスが SIGTERM を無視して残り続けるケースでのみ拒否される（02 (c) で解消）
- メッセージ: `total` → `Server is busy: too many running processes. Please retry later.`、`client` → `Too many running processes from your connection. Please wait for them to finish.`
- `clientKey` は `socket.handshake.address`

### B. 出力量上限（サーバ）

- 環境変数 `NOSPACE_MAX_OUTPUT_BYTES`（既定 1 MiB = 1048576）。`EnvConfig.ts`、`.env.example`、`Config.ts` を更新
- `NospaceSessionImpl`:
  - `process.stdout?.setEncoding('utf8')` / `stderr` も同様（文字分断の解消）。data は string で受け取る
  - stdout + stderr の合計バイト数（`Buffer.byteLength(data, 'utf8')`）を数え、上限を超える chunk は**上限までを切り詰めて**送出し、`\n[Output limit exceeded (N bytes). Killing...]\n` を stderr に出して `kill()` する。以後の出力は破棄
  - 切り詰めは文字単位で行い、マルチバイト文字の途中で切らない（`Buffer.from(data).subarray(0, remain).toString('utf8')` の末尾に生じる `�` を除去）

### C. 出力蓄積上限（クライアント）

#### 純粋関数 `appendOutputEntry`（新規, `src/web/libs/outputBuffer.ts`）

```ts
export interface OutputLimits { maxChars: number }   // 既定 1_000_000
export const OUTPUT_TRUNCATED_MESSAGE = '\n[Output truncated: too much output]\n';

/** 出力エントリ列が truncated 状態か（末尾付近に truncated マーカーがあるか） */
export function isOutputTruncated(entries: OutputEntry[]): boolean;

/**
 * 出力エントリを追加した新しい配列を返す（純粋関数）。
 * - 直前と同じ type のエントリは data を連結して 1 エントリにまとめる（DOM 数の抑制）
 * - stdout / stderr / stdin-echo の合計文字数が上限を超える場合は上限まで切り詰め、
 *   truncated マーカー（type: 'system'）を 1 つ追加する
 * - truncated 後は stdout / stderr / stdin-echo を捨てる。system エントリ
 *   （[Process killed]、[Connection lost] 等）は上限の対象外として常に追加する
 */
export function appendOutputEntry(prev: OutputEntry[], entry: OutputEntry, limits?: OutputLimits): OutputEntry[];
```

- truncated 判定は `OUTPUT_TRUNCATED_MESSAGE` を data に持つ system エントリの有無で行い、atom の型（`OutputEntry[]`）は変えない
- 合計文字数は毎回数える（エントリ連結により配列長は小さく保たれるため許容）

#### 上限到達時の kill（副作用は updater の外で行う）

`setOutputEntries(prev => appendOutputEntry(prev, entry))` の updater は純粋に保つ。kill は以下で行う:

- `useExecutionBackend` に `outputCharsRef = useRef(0)` / `killRequestedRef = useRef(false)` を持つ（effect ローカル変数ではなく ref とし、hook の外から実行ごとにリセットできるようにする）
- `onOutput` コールバック内で、updater とは別にカウンタを加算する。カウント対象は `appendOutputEntry` の上限判定と揃え、stdout / stderr / stdin-echo のみ（system エントリと、`compileOutputAtom` にルーティングされる compile 中の stdout は数えない）
- `outputCharsRef.current > maxChars && !killRequestedRef.current` なら `killRequestedRef.current = true` とし、`backend.kill()` を呼ぶ
- `resetOutputCounter()`（両 ref を 0 / false に戻す）を返り値で公開し、`handleRun` / `handleCompile` / `handleRunCompileOutput` / `handleClearOutput`（いずれも `outputEntriesAtom` をクリアする箇所）と effect 開始時に呼ぶ
- `InputPanel` の stdin エコーはカウンタに加算しない（ユーザー入力でありプロセスを止める理由にならないため。表示上の上限は `appendOutputEntry` が適用する）
- 上限値は `useExecutionBackend` の引数（省略時既定値）で DI 可能にし、テストで小さい値を使う

`InputPanel` の stdin エコー追加も `appendOutputEntry` を使う（`InputPanel` が atom に直接書き込んでいる点の是正は元指摘 12 の範囲とし、本タスクでは関数の差し替えのみ）。

## タスクステップ・チェックリスト

1. [ ] サーバ: `ExecutionConfig` / `Config` / `EnvConfig` / `.env.example` に 3 項目を追加
2. [ ] サーバ: `ExecutionSlotLimiter`, `ExecutionLimitError` 新設、`run` / `compile` に `clientKey` 追加
3. [ ] サーバ: `NospaceSessionImpl` の `finalize()` 一本化（`close` / `error`）、スロット解放
4. [ ] サーバ: Controller の拒否応答（`handleRun` / `handleCompile` の両方）
5. [ ] サーバ: `setEncoding('utf8')`、出力量カウントと超過時 kill
6. [ ] クライアント: `appendOutputEntry` 新設、`useExecutionBackend` / `InputPanel` で使用、超過時 kill
7. [ ] README / `.env.example` の設定説明（プロキシ配下の注意を含む）
8. [ ] テスト

### テスト

| 対象 | ケース |
|---|---|
| `ExecutionSlotLimiter.spec`（新規） | 全体上限・クライアント上限それぞれで拒否 / 解放関数の二重呼び出しで二重解放しない |
| `NospaceExecutionService.spec` | 上限到達時に `ExecutionLimitError`、コールバック未呼び出し、一時ファイル未作成 |
| `NospaceExecutionService.spec` | フェイクプロセスの close でスロットが解放され次の実行が可能 |
| `NospaceExecutionService.spec` | フェイクプロセスが `error` のみ発火してもスロットが解放され、`onExit` が 1 回だけ呼ばれる |
| `NospaceExecutionService.spec` | `error` → `close` の順で発火しても `onExit` は 1 回 |
| `NospaceExecutionService.spec` | バイナリ未検出・書き込み失敗時にスロットがリークしない |
| `NospaceExecutionService.spec` | 出力上限超過で切り詰め + kill、以後の出力が破棄される。マルチバイト文字を境界で壊さない |
| `NospaceController.spec` | run / compile で `ExecutionLimitError` 時に requestId 付きの stderr / `error` status を emit |
| `outputBuffer.spec`（新規） | 同種エントリの連結 / 上限で切り詰めと truncated マーカー 1 つ / truncated 後は stdout を捨て system は追加 |
| `useExecutionBackend.spec` | 上限超過で `backend.kill()` が 1 回だけ呼ばれる / クリア後は再び出力できる |
| `useNospaceExecution.spec` | 上限で kill → 新たに run → 再び上限到達で `kill()` がもう一度呼ばれる |
| `useExecutionBackend.spec` | compile 中の stdout（compileOutput 行き）と system エントリはカウントされない |

## 影響範囲

- サーバ: `NospaceExecutionService.ts`, `NospaceController.ts`, `Config.ts`, `src/interfaces/EnvConfig.ts`, `.env.example`、新規 `ExecutionSlotLimiter.ts`
- クライアント: `useExecutionBackend.ts`, `useNospaceExecution.ts`（カウンタリセット呼び出し）, `InputPanel.tsx`、新規 `src/web/libs/outputBuffer.ts`
- 既存テストへの波及:
  - `NospaceExecutionService.spec.ts` の `FakeChildProcess.stdout` / `stderr` に `setEncoding` を追加し、data を string で emit するよう変更
  - `NospaceController.spec.ts` のフェイクサービスが渡す `ExecutionConfig` に新規必須フィールドを追加。`run` / `compile` の `clientKey` 引数に追従
  - 「出力エントリが chunk ごとに別エントリになる」ことを前提にしたテスト（`useExecutionBackend.spec`, `ExecutionContainer.spec` 等）は連結仕様に合わせて期待値を修正
