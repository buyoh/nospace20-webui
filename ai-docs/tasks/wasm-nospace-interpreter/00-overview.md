# WASM NospaceVM インタプリタ実行機能

## 概要

WASM モジュールに新たに実装された `WasmNospaceVM`（nospace インタプリタ）を使用し、
従来の WebSocket 経由のインタプリタ実行と同等の機能をクライアントサイドで実現する。

`WasmNospaceVM` は nospace ソースコードを**直接ステップ実行**する VM であり、
既存の `WasmWhitespaceVM`（nospace → Whitespace コンパイル → WS VM 実行）とは異なるパスを通る。

## 現状の整理

### 既存の実行パス

| UI モード | flavor=websocket | flavor=wasm |
|---|---|---|
| **Compile** | サーバーでコンパイル | `compile()` API で直接コンパイル |
| **Run** | コンパイル → コンパイル済みコードを実行 | コンパイル → `WasmWhitespaceVM.fromWhitespace()` で実行 |
| **Run(Direct)** | サーバーで直接実行 | ❌ 非対応（compile にリダイレクト） |
| **Test Editor** | サーバーで実行 | ❌ 非対応（compile にリダイレクト） |

### WasmNospaceVM の API

```typescript
class WasmNospaceVM {
  constructor(source: string, stdin: string, opt_passes?: OptPass[] | null, ignore_debug?: boolean | null);
  step(budget: number): VmStepResult;
  flushStdout(): string;
  getReturnValue(): bigint | undefined;
  getTraced(): any;
  is_complete(): boolean;
  total_steps(): number;
  free(): void;
}
```

`WasmWhitespaceVM` との主な差異:
- コンストラクタ引数: `opt_passes` / `ignore_debug` を受け取る（`std_extensions` / `interactive` なし）
- interactive モード未対応（`provideStdin` / `closeStdin` なし）
- デバッグ API 限定: `get_heap()` / `get_stack()` / `pc()` / `disassemble()` なし
- stdout flush: `flushStdout()`（snake_case ではなく camelCase）
- `getReturnValue()` で戻り値の取得が可能

## 実現する機能

`WasmNospaceVM` を用いて、wasm flavor で **Run(Direct)** モードを利用可能にする。

### 実行フロー

1. ユーザーが「Run(Direct)」タブを選択（wasm flavor でも可能に）
2. 実行ボタン押下
3. `WasmExecutionBackend.run()` が呼ばれる
4. `language` が `'ws'` でなく `'standard'` の場合、`WasmNospaceVM` を使用
5. ステップ実行ループで `step(budget)` を繰り返す
6. stdout をフラッシュして出力パネルに表示
7. 完了・エラー・上限到達で実行終了

### capabilities 変更

| capability | 変更前 | 変更後 |
|---|---|---|
| `supportsIgnoreDebug` | `false` | `true` |
| `supportsLanguageSubsetForRun` | `false` | 変更なし (false のまま。WasmNospaceVM は standard 固定) |

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/web/services/WasmExecutionBackend.ts` | `run()` メソッドで `WasmNospaceVM` を使った実行パスを追加 |
| `src/web/containers/ExecutionContainer.tsx` | wasm flavor で Run(Direct) タブを表示可能に |
| `src/web/stores/testEditorAtom.ts` | 必要に応じて OperationMode 型を調整（変更なし想定） |
| `src/web/hooks/useNospaceExecution.ts` | wasm + Run(Direct) 時の ignoreDebug オプション伝搬 |
| `src/tests/web/WasmExecutionBackend.spec.ts` | WasmNospaceVM 実行パスのユニットテスト追加 |
| `src/tests/web/ExecutionContainer.spec.tsx` | wasm flavor で Run(Direct) タブが表示されることのテスト修正 |

## サブドキュメント

- [01-backend-changes.md](01-backend-changes.md) - `WasmExecutionBackend` の変更設計
- [02-ui-changes.md](02-ui-changes.md) - UI / コンテナ / フックの変更設計
- [03-test-plan.md](03-test-plan.md) - テスト計画
