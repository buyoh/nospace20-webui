# コンパイル後 Whitespace 実行でエラーが発生する問題の修正

## 概要

nospace ソースコードを直接実行（Execution mode）した場合は正常に動作するが、Compile mode で Whitespace ターゲットにコンパイルしてから実行すると Whitespace パースエラーが発生する。

## 原因

`WasmExecutionBackend.compile()` メソッド（[WasmExecutionBackend.ts L202](../../src/web/services/WasmExecutionBackend.ts)）で、コンパイル結果の出力に `'\n'` を無条件に付加している。

```typescript
this.outputCallback?.({
  type: 'stdout',
  data: result.output + '\n',   // ← ここで余分な '\n' を追加
  timestamp: Date.now(),
});
```

Whitespace 言語はスペース (U+0020)・タブ (U+0009)・改行 (U+000A) の 3 文字のみで構成されるため、`\n` は有効な命令文字である。余分な `\n` が追加されると、パーサーがそれを不完全な命令の開始として解釈し、エラーとなる。

## データフロー

```
1. compile() → nospace20.compile(code, 'ws', 'standard') → result.output（正しい WS コード）
2. WasmExecutionBackend.compile(): result.output + '\n' を stdout として出力（余分な \n が追加）
3. useNospaceExecution onOutput: compileOutputAtom に output 文字列を蓄積
4. CompileOutputPanel の Run ボタン → handleRunCompileOutput(compileOutput.output, batchInput)
5. WasmWhitespaceVM.fromWhitespace(compiledCode, stdinData) → 余分な \n を命令として解釈 → エラー
```

## 影響範囲

- `ws` ターゲット: 確実に影響
- `ex-ws` ターゲット: 拡張 Whitespace も空白文字が命令であり、同様に影響する可能性大
- `mnemonic` / `json` ターゲット: テキスト出力であり、末尾改行は表示整形として問題なし

## 修正方針

`WasmExecutionBackend.compile()` で、ターゲットが `ws` または `ex-ws` の場合は `'\n'` を付加しない。

```typescript
const outputData = options.target === 'ws' || options.target === 'ex-ws'
  ? result.output
  : result.output + '\n';
this.outputCallback?.({
  type: 'stdout',
  data: outputData,
  timestamp: Date.now(),
});
```

### 代替案（不採用）

- **全ターゲットで `'\n'` 付加を停止**: mnemonic / json の表示整形が崩れる可能性あり
- **`handleRunCompileOutput` で trimEnd()**: 正当な末尾改行も削除してしまうリスクがあり非推奨

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/web/services/WasmExecutionBackend.ts` L196-207 | **バグ箇所**: compile() メソッド |
| `src/web/services/WasmExecutionBackend.ts` L73-78 | `language === 'ws'` 分岐で fromWhitespace 使用 |
| `src/web/hooks/useNospaceExecution.ts` L109-114 | コンパイル出力の atom ルーティング |
| `src/web/hooks/useNospaceExecution.ts` L210-223 | handleRunCompileOutput — コンパイル済みコード実行 |
| `src/web/containers/ExecutionContainer.tsx` L61-62 | compileOutput.output をそのまま実行に渡す |
| `src/web/stores/compileOutputAtom.ts` | コンパイル結果の atom 定義 |
| `src/interfaces/NospaceTypes.ts` L2 | CompileTarget 型定義 ('ws' | 'mnemonic' | 'ex-ws' | 'json') |

## 作業項目

- [ ] `WasmExecutionBackend.compile()` で ws/ex-ws ターゲット時に '\n' を付加しないよう修正
- [ ] 既存テストの更新（ws ターゲットのコンパイル出力テスト）
- [ ] テスト実行・全テスト合格の確認
