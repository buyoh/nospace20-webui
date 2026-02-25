# WebSocket flavor コンパイル・実行対応

## 概要

WebSocket flavor（サーバー側 nospace20 バイナリ実行）にコンパイル機能を追加し、WASM flavor と同等のコンパイル・コンパイル結果実行のワークフローを利用可能にする。

## 現状の問題

- WebSocket flavor では `ServerExecutionBackend.compile()` が `throw new Error('Compile not supported in websocket flavor')` を投げる
- `ServerExecutionBackend.capabilities.supportsCompile = false`
- UI が `supportsCompileMode = isWasm` で WASM 時のみコンパイルモードタブを表示
- nospace20 バイナリは `--mode compile --target <target>` オプションを既にサポートしているが、webui のサーバー側が未対応

## nospace20 CLI のコンパイルサポート

```
nospace20 --mode compile --std <language> --target <target> [--std-ext <ext>...] [-o <output>] <file>
```

| オプション | 値 | 説明 |
|---|---|---|
| `--mode` | `compile` | コンパイルモード |
| `--std` | `standard` / `min` / `ws` | 言語サブセット |
| `--target` | `ws` / `mnemonic` / `json` | 出力ターゲット |
| `--std-ext` | `debug` / `alloc` | 標準拡張（複数指定可） |
| `-o` | ファイルパス | 出力先（未指定時は stdout） |

### WASM API との差分

| ターゲット | CLI | WASM |
|---|---|---|
| `ws` | ○ | ○ |
| `mnemonic` | ○ | ○ |
| `json` | ○ | ○ |
| `ex-ws` | × | ○ |

※ CompileOptions のデフォルト UI は `ws` / `mnemonic` のみ表示しているため、差分は UI に影響しない。

## ユーザーワークフロー

### コンパイル

1. ユーザーが nospace コードをエディタに入力
2. Compile タブに切り替え
3. Language と Target を選択
4. Compile ボタンをクリック
5. サーバーへ `nospace_compile` イベント送信
6. サーバーが `nospace20 --mode compile` を実行
7. 標準出力（コンパイル結果）を `nospace_stdout` で返却
8. コンパイルエラーがあれば `nospace_stderr` で返却
9. ステータスを `nospace_execution_status` で通知（`compiling` → `finished` / `error`）

### コンパイル結果の実行（ws ターゲット時）

1. Whitespace ターゲットでコンパイル完了
2. CompileOutputPanel の Run ボタンをクリック
3. `handleRunCompileOutput(compiledCode, stdinData)` が `backend.run()` を `language: 'ws'` で呼び出し
4. 既存の `nospace_run` プロトコルで Whitespace コードを実行
5. **※ この機能は既存の run プロトコルで動作するため、追加実装不要**

## 変更対象ファイル

### サーバーサイド

| ファイル | 変更内容 |
|---|---|
| `src/interfaces/NospaceTypes.ts` | `nospace_compile` イベント型を追加 |
| `src/app/Services/NospaceExecutionService.ts` | `compile()` メソッド追加 |
| `src/app/Controllers/NospaceController.ts` | `nospace_compile` イベントハンドラ追加 |

### クライアントサイド

| ファイル | 変更内容 |
|---|---|
| `src/web/services/NospaceSocketClient.ts` | `emitCompile()` メソッド追加 |
| `src/web/services/ServerExecutionBackend.ts` | `compile()` 実装、capabilities 更新、コンパイルエラーアノテーション対応 |
| `src/web/containers/ExecutionContainer.tsx` | コンパイルモードを WebSocket でも許可 |

### テスト

| ファイル | 変更内容 |
|---|---|
| `src/tests/app/NospaceExecutionService.spec.ts` | `compile()` のテスト追加 |
| `src/tests/app/NospaceController.spec.ts` | `nospace_compile` ハンドラのテスト追加 |
| `src/tests/web/NospaceSocketClient.spec.ts` | `emitCompile()` のテスト追加 |
| `src/tests/web/ServerExecutionBackend.spec.ts` | `compile()` のテスト追加、capabilities テスト更新 |

## 設計上の判断

### ExecutionStatus `'compiling'` の扱い

コンパイル時は `'running'` ではなく `'compiling'` ステータスを使用する。サーバーの `NospaceSessionImpl` は内部的に `'running'` 状態で動作するが、コントローラーが初回ステータス通知で `'compiling'` を送信する。プロセス完了時のステータスは `'finished'` / `'error'` でコンパイル・実行共通。

### コンパイルエラーアノテーション

ServerExecutionBackend の stderr ハンドラで `tryFormatNospaceErrorJson` が成功した場合、パース済みの `NospaceErrorEntry[]` を `compileErrorsCallback` に渡す。これにより WASM flavor と同様にエディタのアノテーション表示が可能になる。

既知の制限: stderr が複数チャンクに分割された場合、JSON パースが失敗しアノテーションが表示されない可能性がある。この問題は既存の run エラー表示と同じ制限であり、本タスクのスコープ外とする。

### stdin の扱い

コンパイルは入力不要のため、compile リクエストに stdin パラメータは含めない。コンパイル結果の実行時は既存の run プロトコルを使用し、通常通り stdin 送信が可能。

## 実装手順

1. `NospaceTypes.ts` にコンパイルイベント型を追加
2. `NospaceExecutionService.ts` に `compile()` メソッドを追加
3. `NospaceController.ts` に `nospace_compile` ハンドラを追加
4. `NospaceSocketClient.ts` に `emitCompile()` を追加
5. `ServerExecutionBackend.ts` で `compile()` を実装し capabilities を更新
6. `ExecutionContainer.tsx` のモードタブ表示条件を更新
7. テスト追加・更新
8. ビルド確認（`npm run build`）

## ドキュメント構成

| ファイル | 内容 |
|---|---|
| `README.md` | 本ドキュメント（概要・方針） |
| [01-server.md](01-server.md) | サーバーサイドの詳細設計 |
| [02-client.md](02-client.md) | クライアントサイドの詳細設計 |
