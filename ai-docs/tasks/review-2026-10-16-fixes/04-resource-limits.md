# 04. リソース上限（同時実行数・出力のバッファリング）

サーバの同時実行プロセス数に上限を設け、出力の無制限なバッファリングによるサーバ・ブラウザのクラッシュを防ぐ。

作成日: 2026-10-16
更新日: 2026-10-17（公開範囲の前提を反映。クライアント単位上限・サーバ出力量上限を廃止し、背圧方式に変更）
ステータス: 設計完了（未実装）
元指摘: [03-resource-limits-dos.md](../code-review-2026-10-16/03-resource-limits-dos.md)
依存: [01](01-session-request-id.md)（requestId、`emitRequestError`、`SessionCallbacks` の新シグネチャ）

## 前提（公開範囲）

AGENTS.md の通り、外部公開するのはフロントエンド + WASM 実行環境（静的配布）のみで、node サーバを経由する native 実行環境は外部公開しない。

- サーバ側: **悪意ある利用者への対策（DoS 対策・公平性・認証）は不要**。正規の利用でも起こりうる**クラッシュ（メモリ枯渇・プロセス過多）の防止**のみを目的とする
- クライアント側: 外部公開されるため、任意のプログラムの出力でブラウザタブがクラッシュしないことを保証する

## 設計・方針

### 現状の問題（要約）

- `NOSPACE_MAX_PROCESSES` は `Config` で読み込まれるが未使用。同時実行数に上限がない
- 子プロセスの出力は chunk ごとに即 `socket.emit` され、送信が追いつかない場合は engine.io の `writeBuffer` に無制限に蓄積される。chunk ごとの `data.toString()` で UTF-8 マルチバイト文字が分断される
- クライアントは出力を無制限に配列へ追加し DOM も増え続ける

### A. 同時実行数上限（サーバ）

`NOSPACE_MAX_PROCESSES`（既存、既定 5）による全体上限のみを実装する。クライアント単位の上限は設けない。

#### `ExecutionSlotLimiter`（新規, `src/app/Services/ExecutionSlotLimiter.ts`）

```ts
/** 同時実行プロセス数を制限するカウンタ */
export class ExecutionSlotLimiter {
  constructor(private readonly max: number) {}
  /** 空きがあれば確保して解放関数を返す（解放関数は冪等）。空きがなければ null */
  tryAcquire(): (() => void) | null;
}
```

- `NospaceExecutionService` のコンストラクタで注入（既定は `new ExecutionSlotLimiter(config.nospaceMaxProcesses)`）
- `ExecutionConfig` に `nospaceMaxProcesses` を追加
- `spawnSession` の**一時ファイル書き込み前**に `tryAcquire()`。取得できなければ `ExecutionLimitError`（新規）を throw する。コールバックは呼ばない
- 未サポート target の早期エラーはスロットを確保しない。バイナリ未検出・一時ファイル書き込み失敗はスロット確保後に検出されるため、その場で解放する

#### スロット解放と終了処理の一本化

`NospaceSessionImpl` の終了処理を冪等な `finalize()` にまとめ、**`close` と `error` の両イベントから呼ぶ**。

```ts
private finalized = false;
private finalize(code: number | null, status: SessionStatus): void {
  if (this.finalized) return;
  this.finalized = true;
  this._exitCode = code;
  if (this._status !== 'killed') this._status = status;
  this.cleanup();          // タイマー解除・一時ファイル削除・背圧リスナー解除
  this.releaseSlot();      // ExecutionSlotLimiter の解放関数
  this.callbacks.onExit(this.sessionId, this._status, code);
}
// process.on('close', (code) => this.finalize(code, code === 0 ? 'finished' : 'error'));
// process.on('error', (err) => { this.callbacks.onStderr(this.sessionId, `${err.message}\n`); this.finalize(null, 'error'); });
```

- spawn 失敗（EACCES / EAGAIN）では `close` が来ないことがあるため、`error` からの解放が必須。`error` リスナーの追加は元指摘 02 (a)（未処理 `error` によるサーバ停止）の解消も兼ねる
- `error` の後に `close` が来ても `finalized` により二重通知しない

> 注意: SIGKILL フォールバックが壊れている現状（元指摘 02 (c)）では、SIGTERM を無視するプロセスが close せずスロットを解放しない。02 (c) は本タスク対象外だが、本タスクの直後に対応すること。

#### Controller の拒否応答

- `handleRun` / `handleCompile` の順序は従来通り（旧セッションを kill → 新規実行を開始）
- `ExecutionLimitError` なら `emitRequestError(socket, requestId, 'Server is busy: too many running processes. Please retry later.\n')`（01 で導入）で通知

### B. 出力の背圧制御（サーバ）

サーバでは出力量の上限を設けない。ただし、ブラウザへの送信が追いつかない場合に engine.io の `writeBuffer` が無制限に伸びるため、**送信待ちが溜まったら子プロセスの出力読み取りを一時停止する**背圧制御を入れる。

#### 蓄積の経路

engine.io の `Socket.sendPacket` はパケットを `writeBuffer` に積み、`transport.writable` のときだけ `flush()` でトランスポートへ渡す。WebSocket トランスポートは送信完了まで `writable = false` になるため、ブラウザ側の受信や描画が遅いと、子プロセスの出力は `writeBuffer` に溜まり続ける（30 秒のタイムアウトまで）。`flush()` が書き出すと engine.io の Socket は `'drain'` を発火する（engine.io 6.6.10 の `build/socket.js` で確認）。

#### 方式

- 子プロセスの stdout / stderr を `pause()` すると、パイプが満杯になった時点で子プロセスの write がブロックされる。これにより、サーバ内に溜まるのは engine.io の高水位分とパイプバッファ（数十 KB）だけになる
- 高水位を超えたら `pause()`、`drain` で低水位を下回ったら `resume()` する

#### 抽象化（DI）

engine.io の `writeBuffer` に直接依存しないよう、送信路の混雑状況を抽象化する（テストではフェイクを注入する）。

```ts
/** 出力の送信先の混雑状況（背圧判定用） */
export interface OutputFlowControl {
  /** 送信待ちが高水位を超えているか */
  isCongested(): boolean;
  /** 送信待ちが捌けたときに呼ばれるリスナーを登録し、解除関数を返す */
  onDrain(listener: () => void): () => void;
}
```

- 実装 `SocketFlowControl`（新規, `src/app/Web/SocketFlowControl.ts`）: `socket.conn.writeBuffer.length >= highWaterPackets`（既定 64）で混雑と判定し、`socket.conn.on('drain', ...)` を購読する
  - `writeBuffer` は engine.io の公開プロパティだが、ドキュメント化された API ではない。依存箇所をこのクラスに閉じ込め、engine.io の更新時はここだけを確認すればよいようにする
- `run()` / `compile()` の引数に `flowControl?: OutputFlowControl` を追加（省略時は背圧なし）。Controller が socket ごとに生成して渡す
- `NospaceSessionImpl`: 各 data 受信後に `flowControl.isCongested()` なら stdout / stderr を `pause()` し、`onDrain` で混雑が解消していれば `resume()` する。`finalize()` で `onDrain` の購読を解除する
- タイムアウト（`nospaceTimeout`）は従来通り動作するため、背圧で停止したまま終わらないプロセスもタイムアウトで kill される

#### 文字分断の解消

`process.stdout?.setEncoding('utf8')`（stderr も同様）とし、data を string で受け取る。

### C. 出力保持数の上限（クライアント）

外部公開される WASM 実行環境を含め、出力によるブラウザのクラッシュを防ぐため、出力パネルが保持する量に上限を設ける。**上限に達しても実行は止めず、古い出力から捨てる**（最新の出力を表示し続ける）。

#### 純粋関数 `appendOutputEntry`（新規, `src/web/libs/outputBuffer.ts`）

```ts
export interface OutputLimits {
  /** 保持する合計文字数の上限（既定 1_000_000） */
  maxChars: number;
}
export const OUTPUT_OMITTED_MESSAGE = '[Earlier output omitted]\n';

/**
 * 出力エントリを追加した新しい配列を返す（純粋関数）。
 * - 直前と同じ type のエントリは data を連結して 1 エントリにまとめる（DOM 数の抑制）
 * - 合計文字数が上限を超えたら、先頭から古いエントリ（または先頭エントリの前半）を捨てて上限内に収め、
 *   先頭に省略マーカー（type: 'system'）を 1 つだけ置く
 */
export function appendOutputEntry(prev: OutputEntry[], entry: OutputEntry, limits?: OutputLimits): OutputEntry[];
```

- 省略マーカーは `OUTPUT_OMITTED_MESSAGE` を data に持つ system エントリで判定し、atom の型（`OutputEntry[]`）は変えない。マーカー自身は合計文字数に数えない
- 合計文字数は毎回数える（エントリ連結により配列長は小さく保たれるため許容）
- 先頭エントリの一部を捨てる場合、サロゲートペアの途中で切らない
- `useExecutionBackend` の `onOutput` と `InputPanel` の stdin エコーで使用する（`InputPanel` が atom に直接書き込んでいる点の是正は元指摘 12 の範囲とし、本タスクでは関数の差し替えのみ）
- 上限値は `useExecutionBackend` の引数（省略時既定値）で DI 可能にし、テストで小さい値を使う
- compile 中の stdout（`compileOutputAtom` 行き）は対象外。compile 出力はソースの規模に比例し、無限に増えないため

実行を止めない理由: 出力が多いこと自体は異常ではなく、サーバ側はタイムアウト、WASM 側は `maxTotalSteps` で実行時間が有限に抑えられているため。

## タスクステップ・チェックリスト

1. [ ] サーバ: `ExecutionConfig` に `nospaceMaxProcesses` を追加
2. [ ] サーバ: `ExecutionSlotLimiter`, `ExecutionLimitError` 新設、Service への組み込み
3. [ ] サーバ: `NospaceSessionImpl` の `finalize()` 一本化（`close` / `error`）、スロット解放
4. [ ] サーバ: Controller の拒否応答（`handleRun` / `handleCompile` の両方）
5. [ ] サーバ: `OutputFlowControl` / `SocketFlowControl` 新設、Session の pause / resume、`setEncoding('utf8')`
6. [ ] クライアント: `appendOutputEntry` 新設、`useExecutionBackend` / `InputPanel` で使用
7. [ ] テスト

### テスト

| 対象 | ケース |
|---|---|
| `ExecutionSlotLimiter.spec`（新規） | 上限まで取得可 / 超過で null / 解放関数の二重呼び出しで二重解放しない |
| `NospaceExecutionService.spec` | 上限到達時に `ExecutionLimitError`、コールバック未呼び出し、一時ファイル未作成 |
| `NospaceExecutionService.spec` | フェイクプロセスの close でスロットが解放され次の実行が可能 |
| `NospaceExecutionService.spec` | フェイクプロセスが `error` のみ発火してもスロットが解放され、`onExit` が 1 回だけ呼ばれる |
| `NospaceExecutionService.spec` | `error` → `close` の順で発火しても `onExit` は 1 回 |
| `NospaceExecutionService.spec` | バイナリ未検出・書き込み失敗時にスロットがリークしない |
| `NospaceExecutionService.spec` | フェイク `OutputFlowControl` が混雑を返すと stdout / stderr が pause され、drain 通知で resume される。終了後は drain 購読が解除される |
| `NospaceController.spec` | run / compile で `ExecutionLimitError` 時に requestId 付きの stderr / `error` status を emit |
| `outputBuffer.spec`（新規） | 同種エントリの連結 / 上限超過で古い出力が捨てられ最新が残る / 省略マーカーは先頭に 1 つだけ / サロゲートペアを壊さない |

`SocketFlowControl` は engine.io の内部状態に依存する薄いアダプタのため、単体テストは追加しない（AGENTS.md「Unit テストは複雑な場合に限る」）。

## 影響範囲

- サーバ: `NospaceExecutionService.ts`, `NospaceController.ts`、新規 `ExecutionSlotLimiter.ts`, `SocketFlowControl.ts`
- クライアント: `useExecutionBackend.ts`, `InputPanel.tsx`、新規 `src/web/libs/outputBuffer.ts`
- 既存テストへの波及:
  - `NospaceExecutionService.spec.ts` の `FakeChildProcess.stdout` / `stderr` に `setEncoding` / `pause` / `resume` を追加し、data を string で emit するよう変更
  - `NospaceController.spec.ts` のフェイクサービスが渡す `ExecutionConfig` に `nospaceMaxProcesses` を追加
  - 「出力エントリが chunk ごとに別エントリになる」ことを前提にしたテスト（`useExecutionBackend.spec`, `ExecutionContainer.spec` 等）は連結仕様に合わせて期待値を修正
