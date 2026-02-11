# テストコード レビュー・改善計画

## 概要

既存テストコードをプロジェクトの要件に照らしてレビューし、要件違反・カバレッジ不足を特定した結果と改善計画をまとめる。

## 対象ファイル

### 既存テストファイル

| テストファイル | テスト対象 |
|---|---|
| `src/tests/app/NospaceExecutionService.spec.ts` | `src/app/Services/NospaceExecutionService.ts` |
| `src/tests/web/CodeTextarea.spec.tsx` | `src/web/components/editor/CodeTextarea.tsx` |
| `src/tests/web/ExecutionControls.spec.tsx` | `src/web/components/execution/ExecutionControls.tsx` |

### テストが存在しないモジュール

| モジュール | 重要度 | 理由 |
|---|---|---|
| `src/app/Controllers/NospaceController.ts` | 高 | セッション管理、Socket.IOイベント処理等のビジネスロジックを含む |
| `src/web/hooks/useNospaceExecution.ts` | 中 | 実行操作のフック。atom/socketへの依存が多く結合テスト寄り |
| `src/web/hooks/useNospaceSocket.ts` | 中 | ソケット接続管理。外部依存が大きい |
| `src/web/components/execution/InputPanel.tsx` | 低 | stdin入力処理。atomへの直接依存あり |
| `src/web/components/execution/OutputPanel.tsx` | 低 | 出力表示。atomへの直接依存あり |
| `src/web/components/layout/SplitPane.tsx` | 低 | ドラッグ操作のUIコンポーネント |

---

## レビュー結果

### 1. NospaceExecutionService.spec.ts — 問題多数

#### 問題 1-1: 実ファイルシステムへのアクセス（要件違反）

**要件**: 「実際にリモートにアクセスしたり、ファイルを作成するようなテストの作成は禁止。必ずモックを使用」

**現状**: テストの `beforeEach` で `mkdirSync('./tmp')` を呼び、`service.run()` 内部では `writeFileSync` で一時ファイルを実際に書き込んでいる。バイナリが存在すれば `spawn` で実プロセスが起動する。

**原因**: `NospaceExecutionService` がファイルシステム操作 (`writeFileSync`, `existsSync`, `unlinkSync`) やプロセス生成 (`spawn`)、設定値 (`Config`) を直接 import しており、依存性注入の仕組みがない。

**要件**: 「Mock ライブラリ等によるメソッドの差し替えは禁止。依存性注入やテンプレートを使用する」

**改善方針**: `NospaceExecutionService` に依存性注入を導入し、テストではスタブ実装を渡す。詳細は後述の改善計画を参照。

#### 問題 1-2: 不十分なアサーション

**現状**:
- 「バイナリが存在しない場合、エラーを返す」テスト: `expect(session).toBeDefined()` のみ。`onStderr` が呼ばれたか、`onExit(1)` が呼ばれたか、`session.status === 'error'` かを検証していない。コメントでも「Configをモック化するか〜」と書いてあるが未対応。

**改善方針**: DI導入後、バイナリパスを制御し、エラーコールバックの呼び出しやステータスを正しくアサートする。

#### 問題 1-3: テストケースの不足

以下の動作がテストされていない:
- `sendStdin()` による標準入力の書き込み
- タイムアウトによるプロセス自動kill
- ステータス遷移 (`running` → `finished` | `error` | `killed`)
- 一時ファイルのクリーンアップ（`cleanup()` メソッド）
- SIGTERM → SIGKILL フォールバック
- コマンド引数の構築（`--std`, `--debug`, `--ignore-debug` フラグ）
- 同時実行セッション
- `writeFileSync` 失敗時の例外

#### 問題 1-4: クリーンアップの不確実性

テスト失敗時にプロセスやファイルが残る可能性がある。`afterEach` でセッションの強制クリーンアップをすべき。

---

### 2. CodeTextarea.spec.tsx — 軽微な不足

**全体評価**: 基本的に良好。

**不足点**:
- Tabキー押下でスペース2つが挿入される機能のテストがない（コンポーネントに `onKeyDown` ハンドラがある場合）

---

### 3. ExecutionControls.spec.tsx — 十分

**全体評価**: 良好。Run/Stopボタンの表示・有効/無効状態・クリックハンドラを網羅している。

---

## 改善計画

### フェーズ 1: NospaceExecutionService のリファクタリング（DI 導入）

`NospaceExecutionService` のテスタビリティを向上させるため、外部依存を注入可能にする。

#### 1-1. 依存のインターフェース化

以下の依存をインターフェース（または型）として抽出する:

```typescript
/** ファイルシステム操作の抽象 */
interface FileSystem {
  existsSync(path: string): boolean;
  writeFileSync(path: string, data: string, encoding: string): void;
  unlinkSync(path: string): void;
  mkdirSync(path: string, options?: { recursive: boolean }): void;
}

/** プロセス生成の抽象 */
interface ProcessSpawner {
  spawn(command: string, args: string[]): ChildProcess;
}

/** 設定値の抽象 */
interface ExecutionConfig {
  nospaceBinPath: string;
  nospaceTimeout: number;
}
```

#### 1-2. コンストラクタでの依存注入

```typescript
export class NospaceExecutionService {
  constructor(
    private readonly config: ExecutionConfig = Config,
    private readonly fs: FileSystem = { existsSync, writeFileSync, unlinkSync, mkdirSync },
    private readonly spawner: ProcessSpawner = { spawn }
  ) {}
}
```

デフォルト引数で本番コードの変更は不要。テストではスタブを注入できる。

#### 1-3. NospaceSessionImpl のリファクタリング

`NospaceSessionImpl` も `config.nospaceTimeout` や `fs` を受け取るようにする。

---

### フェーズ 2: NospaceExecutionService テストの書き直し

DI導入後、以下のテストケースを追加・修正する:

| テストケース | 検証内容 |
|---|---|
| セッション作成 | sessionId が生成され、sessions マップに登録される |
| バイナリ不存在 | onStderrにエラーメッセージ、onExit(1)呼び出し、status が 'error' |
| 正常終了 | status が 'finished'、exitCode が 0、一時ファイルが削除される |
| 異常終了 | status が 'error'、exitCode が非0 |
| kill | status が 'killed'、SIGTERM が送信される |
| sendStdin | process.stdin.write にデータが渡される |
| タイムアウト | 設定時間後に自動 kill される |
| コマンド引数 | language, debug, ignoreDebug の組み合わせで正しい引数列が構築される |
| 一時ファイル書き込み失敗 | 例外が throw され、onStderr/onExit が呼ばれる |
| クリーンアップ | exit 後に一時ファイルが削除される、タイムアウトタイマーがクリアされる |
| getSession | 存在するID/存在しないID |
| removeSession | 削除後にgetSessionでundefined |

**注意**: すべてのテストでスタブ（fake）の `FileSystem`, `ProcessSpawner`, `ExecutionConfig` を使用し、実ファイルシステム・実プロセスにはアクセスしない。`jest.fn()` はコールバック引数（`onStdout`, `onStderr`, `onExit`）の呼び出し検証に使用する（メソッドの差し替えではないので許容）。

---

### フェーズ 3: NospaceController テストの新規作成

`NospaceController` は以下のロジックを含むため、Unitテストを作成する:

| テストケース | 検証内容 |
|---|---|
| handleRun | executionService.run が適切な引数で呼ばれ、socket.emit で 'running' ステータスが送信される |
| handleRun（既存セッション有り） | 既存セッションが kill + remove される |
| handleRun（バッチモード + stdinData） | session.sendStdin にデータが渡される |
| handleStdinInput | session.sendStdin に改行付きデータが渡される |
| handleKill | session.kill が呼ばれ、'killed' ステータスが emit される |
| handleDisconnect | セッションの kill + remove + マップからの削除 |
| onExit コールバック | execution_status emit、セッション削除、マップからの削除 |

**設計**: `NospaceController` は `new NospaceExecutionService()` を内部で生成しているため、DI に対応させ、テストでは fake の `NospaceExecutionService` を注入する。Socket オブジェクトも `on`/`emit` を持つスタブを作成する。

---

### フェーズ 4: フロントエンドテストの拡充（優先度低）

以下はスコープが大きいため、必要に応じて後日対応する:

- `CodeTextarea` の Tabキー挿入テスト追加
- `InputPanel` のバッチ/インタラクティブ切り替えテスト
- `OutputPanel` の出力レンダリングテスト
- `useNospaceExecution` / `useNospaceSocket` は外部依存（socket.io-client, jotai store）が大きく、Unitテストの費用対効果が低い。結合テスト（large テスト）として扱う方が適切。

---

## 優先度

1. **フェーズ 1 + 2** (高): NospaceExecutionService のリファクタリングとテスト書き直し — 要件違反の解消が最優先
2. **フェーズ 3** (中): NospaceController テストの新規作成 — ビジネスロジックのカバレッジ向上
3. **フェーズ 4** (低): フロントエンドテストの拡充 — 現状でも最低限のカバレッジはある

## ステータス

- [ ] フェーズ 1: NospaceExecutionService リファクタリング
- [ ] フェーズ 2: NospaceExecutionService テスト書き直し
- [ ] フェーズ 3: NospaceController テスト新規作成
- [ ] フェーズ 4: フロントエンドテスト拡充
