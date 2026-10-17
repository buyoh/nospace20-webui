# 03. 子プロセスに渡す環境変数の許可リスト

作成日: 2026-10-17
ステータス: 完了

## 方針

01 で設定ファイルの値は `process.env` に入らなくなるが、実際の環境変数（シェルや systemd 由来。トークン等を含み得る）は依然として子プロセスに継承される。多層防御として、nospace20 には許可リストの変数だけを渡す。

### 許可リスト

| 変数 | 理由 |
|---|---|
| `LANG`, `LC_ALL`, `LC_CTYPE` | 出力の文字コード・ロケール |
| `RUST_BACKTRACE` | nospace20（Rust）の panic 調査用 |

これ以外（`PATH`, `HOME` を含む）は渡さない。nospace20 はパス指定で起動され、引数のファイルを読み標準入出力でやり取りするだけで、他のコマンドを起動しないため不要。必要になった時点で追加する。

### 実装

`src/app/Services/ChildProcessEnv.ts`（新規）:

```ts
/** 子プロセスに引き継ぐ環境変数 */
export const CHILD_PROCESS_ENV_ALLOWLIST = ['LANG', 'LC_ALL', 'LC_CTYPE', 'RUST_BACKTRACE'] as const;

/** 許可リストにあり、値が定義されている環境変数だけを取り出す */
export function buildChildProcessEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
```

同ファイルに spawner の生成関数を置き、`NospaceExecutionService` の既定の spawner をこれに置き換える:

```ts
/**
 * 子プロセスに許可リストの環境変数だけを渡す ProcessSpawner を生成する。
 * spawn に env を指定しないとサーバーの全環境変数が継承される。
 */
export function createProcessSpawner(
  env: NodeJS.ProcessEnv = process.env,
  spawnFn: typeof spawn = spawn
): ProcessSpawner {
  const childEnv = buildChildProcessEnv(env);
  return { spawn: (command, args) => spawnFn(command, args, { env: childEnv }) };
}
```

- 子プロセスの環境は生成時（サーバー起動時）に一度だけ計算する
- `ProcessSpawner` インターフェース・`NospaceExecutionService` のコンストラクタ引数は変更しない（既定値を `createProcessSpawner()` に置き換えるだけ）。既存テストのフェイク spawner に影響しない

## テスト

ロジックは単純なフィルタだが、セキュリティ上の性質（許可リスト外を渡さない）を固定するため 1 ケースだけ追加する（`src/tests/app/ChildProcessEnv.spec.ts`）:

- `createProcessSpawner(env, fakeSpawn)` で spawn したとき、`fakeSpawn` の第 3 引数 `options.env` が許可リストの変数（定義済みのもの）だけを持ち、`SECRET_TOKEN` / `PATH` 等を含まないこと

## 補足

nospace から環境変数を読めるかは未確認（元指摘のとおり）。本対応はその確認を待たずに、渡す範囲を最小にする。
