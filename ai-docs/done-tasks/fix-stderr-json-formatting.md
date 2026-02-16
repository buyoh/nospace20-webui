# fix: stderr の nospace エラー JSON を整形して表示

## 課題

サーバー側の nospace バイナリがコンパイルエラー時に stderr へ
`{"success":false,"errors":[{"message":"undefined function: sdf__puti"}]}` のような
JSON をそのまま出力し、UI にも生 JSON が表示されていた。

WASM 側でもコンストラクタ (`new WasmWhitespaceVM`, `fromWhitespace`) や
`compile` の catch 句で `ResultErr` オブジェクトが throw された場合、
`JSON.stringify` で生 JSON が表示されていた。

## 解決策

- `src/web/libs/formatNospaceErrors.ts` を新規作成
  - `tryFormatNospaceErrorJson()`: 文字列を nospace エラー JSON としてパースし整形
  - `formatErrorEntries()`: エラーエントリ配列を人間が読みやすい文字列に変換
  - `isNospaceErrorResult()`: 値が ResultErr 型かを判定する型ガード
- `ServerExecutionBackend.ts` の `onStderr` ハンドラで `tryFormatNospaceErrorJson()` を適用
- `WasmExecutionBackend.ts`:
  - `compile` メソッドのエラー整形を共通ユーティリティ `formatErrorEntries()` に統一
  - 2箇所の catch 句で `isNospaceErrorResult()` を使い、ResultErr 型の場合は整形表示

## 追加テスト

- `src/tests/web/formatNospaceErrors.spec.ts`: ユーティリティ関数のテスト (19 ケース)
- `src/tests/web/ServerExecutionBackend.spec.ts`: stderr JSON 整形のテスト (2 ケース追加)
- `src/tests/web/WasmExecutionBackend.spec.ts`: ResultErr throw 時の整形テスト (2 ケース追加)
