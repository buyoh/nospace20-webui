# テスト計画

## 概要

WASM NospaceVM インタプリタ実行機能のテスト計画。

## Unit テスト

### 1. WasmExecutionBackend - NospaceVM 実行パス

**ファイル**: `src/tests/web/WasmExecutionBackend.spec.ts`

既存のフェイクローダーに `WasmNospaceVM` クラスのフェイクを追加する。

#### テストケース

| テストケース | 説明 |
|---|---|
| `direct: true, language: 'standard'` の場合に WasmNospaceVM が使用される | VM 選択ロジック |
| `direct: false` の場合に WasmWhitespaceVM が使用される | 従来動作の確認 |
| NospaceVM で正常完了時に stdout が出力される | ステップ実行ループ |
| NospaceVM で正常完了時にシステムメッセージにステップ数が表示される | 完了メッセージ |
| NospaceVM でエラー発生時に stderr が出力される | エラーハンドリング |
| NospaceVM コンストラクタ例外時に compileErrors が通知される | コンパイルエラー |
| NospaceVM に opt_passes が渡される | オプション伝搬 |
| NospaceVM に ignore_debug が渡される | オプション伝搬 |
| kill() で NospaceVM 実行が中断される | 中断処理 |
| maxTotalSteps 超過で実行が停止される | 実行制限 |

### 2. ExecutionContainer - Run(Direct) タブ表示

**ファイル**: `src/tests/web/ExecutionContainer.spec.tsx`

#### テストケース

| テストケース | 説明 |
|---|---|
| WASM flavor で Run(Direct) タブが表示される | タブ表示制御 |
| WASM flavor で Run(Direct) 選択時に compile へリダイレクトされない | リダイレクト解除 |
| WASM flavor + Run(Direct) で Run ボタン押下時に `direct: true` が渡される | フラグ伝搬 |

### 3. useNospaceExecution - handleRun の direct オプション

**ファイル**: `src/tests/web/useNospaceExecution.spec.ts`（既存 or 新規）

#### テストケース

| テストケース | 説明 |
|---|---|
| `handleRun(stdin, { direct: true })` で `RunOptions.direct` が true で渡される | フラグ伝搬 |
| `handleRun(stdin)` で `RunOptions.direct` が undefined で渡される | デフォルト動作 |

### 4. VM アダプター

**ファイル**: `src/tests/web/WasmExecutionBackend.spec.ts` に統合

アダプターは内部実装のためテストはバックエンド経由の結合テストで担保する。

## テスト環境のフェイク

### WasmNospaceVM フェイク

```typescript
class FakeWasmNospaceVM {
  private _stdout = '';
  private _complete = false;
  private _steps = 0;
  private _traced: any = {};
  private _returnValue: bigint | undefined = undefined;

  constructor(
    public source: string,
    public stdin: string,
    public opt_passes?: string[] | null,
    public ignore_debug?: boolean | null,
  ) {}

  step(budget: number): VmStepResult {
    this._steps += budget;
    if (this._steps >= 100) {
      this._complete = true;
      return { status: 'complete' };
    }
    return { status: 'suspended' };
  }

  flushStdout(): string {
    const out = this._stdout;
    this._stdout = '';
    return out;
  }

  getReturnValue(): bigint | undefined {
    return this._returnValue;
  }

  getTraced(): any {
    return this._traced;
  }

  is_complete(): boolean {
    return this._complete;
  }

  total_steps(): number {
    return this._steps;
  }

  free(): void {}
}
```

## 確認観点

- [ ] WASM flavor で Run(Direct) タブが表示される
- [ ] Run(Direct) タブから実行ボタンを押すと WasmNospaceVM で実行される
- [ ] stdout が出力パネルに表示される
- [ ] エラー時に stderr が出力される
- [ ] コンパイルエラー時にエディタアノテーションが表示される
- [ ] ignoreDebug オプションが反映される
- [ ] optPasses オプションが反映される
- [ ] kill ボタンで実行が中断される
- [ ] 実行制限（maxTotalSteps）で停止する
- [ ] 既存の Compile / Run モードが壊れていない
