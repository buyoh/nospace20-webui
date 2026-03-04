# websocket モードの build/run で --std-ext フラグが渡されない問題の修正

## 問題

websocket モードで nospace コードをコンパイル・実行する際、CLI バイナリに `--std-ext` フラグが渡されておらず、`alloc` などの標準拡張を使用するコードがエラーになっていた。

### 原因

`NospaceExecutionService` の `compile()` および `run()` メソッドが、`CompileOptions.stdExtensions` / `RunOptions.stdExtensions` を CLI の `--std-ext` フラグに変換していなかった。WASM バックエンドでは `stdExtensions` を API に直接渡していたが、サーバー側（CLI 実行）では無視されていた。

また、`ExecutionBackend.run()` インターフェースで `stdExtensions` が第4引数として分離されており、`ServerExecutionBackend` でアンダースコアプレフィクス (`_stdExtensions`) 付きで無視されていた。

## 修正内容

| ファイル | 変更 |
|---|---|
| `src/app/Services/NospaceExecutionService.ts` | `compile()` と `run()` に `--std-ext` フラグ生成を追加 |
| `src/interfaces/NospaceTypes.ts` | `RunOptions` に `stdExtensions?: string[]` を追加 |
| `src/web/services/ExecutionBackend.ts` | `run()` の第4引数 `stdExtensions` を削除 |
| `src/web/services/WasmExecutionBackend.ts` | `options.stdExtensions` を使用するように変更 |
| `src/web/services/ServerExecutionBackend.ts` | `_stdExtensions` パラメータを削除 |
| `src/web/hooks/useNospaceExecution.ts` | `stdExtensions` を `RunOptions` に含めて渡すように変更 |
| `components/nospace20/nospace20-help.txt` | `--std-ext` オプションを追記 |

### テスト追加

- `NospaceExecutionService.spec.ts`: compile/run で `--std-ext` が正しく渡される/省略される検証
- `WasmExecutionBackend.spec.ts`: `stdExtensions` が `RunOptions` 経由で渡される検証

## 状態

完了
