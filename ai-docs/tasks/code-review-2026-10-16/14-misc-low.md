# 14. その他の軽微な指摘

- 重要度: **low**

## 問題点と解決策

### (a) `sourceCodeAtom` の localStorage 保存

`src/web/stores/editorAtom.ts:19-22`。キー入力ごとに全文を同期書き込み。`atomWithStorage` は storage イベントを購読するため、複数タブで相互上書きされる。保存値の型検証なし。秘密情報は扱わないためセキュリティ上の問題はない。

- 解決策: 書き込みの debounce、`getOnInit` / カスタム storage で型検証、タブ間同期の無効化（`subscribe` を省いた storage）
- 影響範囲: `editorAtom.ts` のみ

### (b) `isNospaceErrorResult` の検証不足

`src/web/libs/formatNospaceErrors.ts:64-77`。`line` / `column` の型を検証しておらず、非数値だと Ace の row が NaN になる。

- 解決策: `typeof === 'number' && Number.isFinite` を確認
- 影響範囲: `formatNospaceErrors.ts`, 同 spec

### (c) stderr chunk 分割時の JSON パース失敗（要確認）

`src/web/services/ServerExecutionBackend.ts:66-80`。stderr が chunk 分割されると JSON をパースできずアノテーションが出ない可能性。サーバ側のバッファリング挙動は未確認。

- 解決策: compile セッション中は stderr をバッファし、終了時にまとめてパース
- 影響範囲: `ServerExecutionBackend`（または compile 用 hook）
