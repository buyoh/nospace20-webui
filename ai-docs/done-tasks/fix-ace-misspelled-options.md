# Ace Editor "misspelled option" 警告の修正

## 概要

ブラウザコンソールに以下の警告が表示される問題を修正する。

```
misspelled option "enableBasicAutocompletion"
misspelled option "enableLiveAutocompletion"
misspelled option "enableSnippets"
```

## 原因

`src/web/components/editor/NospaceEditor.tsx` の `<AceEditor>` コンポーネントで、
`setOptions` prop 内に `enableBasicAutocompletion`, `enableLiveAutocompletion`, `enableSnippets` を渡している。

`react-ace` の内部実装では、`setOptions` に渡されたオプションは `editor.setOption()` を直接呼び出す。
しかし、これらのオプションは `ace-builds/src-noconflict/ext-language_tools` 拡張をインポートしないと
Ace Editor の `$options` に登録されないため、「misspelled option」警告が発生する。

なお、`react-ace` はこれらのオプションを「トップレベル props」として渡した場合、
`$options` の存在を事前にチェックしてから `setOption()` を呼ぶ仕組みになっている（値が falsy の場合は無視される）。

## 修正方針

`setOptions` から以下の3つのオプションを削除する。

- `enableBasicAutocompletion: false`
- `enableLiveAutocompletion: false`
- `enableSnippets: false`

### 削除で問題ない理由

- 3つとも `false`（無効）に設定されている
- `ext-language_tools` をインポートしていない状態では、オートコンプリートやスニペット機能はそもそも存在しない
- Ace Editor のデフォルト動作としてこれらは無効

## 対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/web/components/editor/NospaceEditor.tsx` | `setOptions` から3つのオプションを削除 |

## テスト

- 既存のテスト `src/tests/web/NospaceEditor.spec.tsx` が引き続きパスすることを確認
- ブラウザコンソールで警告が消えることを確認

## 進捗

- [x] `setOptions` から3つのオプション削除（コード内にコメント追加）
- [x] 既存テスト全3件パス確認（2026-02-25）
