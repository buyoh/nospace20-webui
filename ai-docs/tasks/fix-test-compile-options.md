# テスト失敗修正: CompileOptions Target セレクター

## 概要

`CompileOptions.spec.tsx` の「Target セレクターに全てのオプションが含まれる」テストが失敗している。
UI コンポーネントの変更にテストが追随していないことが原因。

## 失敗内容

- **テストファイル**: `src/tests/web/CompileOptions.spec.tsx`
- **テスト名**: `Target セレクターに全てのオプションが含まれる`
- **エラー**:
  ```
  Expected: ['ws', 'mnemonic', 'ex-ws', 'json']
  Received: ['ws', 'mnemonic']
  ```

## 原因

コミット `b6157f7`（"Remove extended whitespace and json"）にて、`CompileOptions.tsx` の Target セレクターから `ex-ws`（Extended Whitespace）と `json`（JSON）の `<option>` が意図的に削除された。
しかし、対応するテストは更新されなかった。

この状況は既に `ai-docs/done-tasks/fix-compile-ws-trailing-newline/00-overview.md` に
「既存の未関連失敗テスト」として記録されていた。

## 影響範囲

| ファイル | 状態 | 説明 |
|---------|------|------|
| `src/web/components/execution/CompileOptions.tsx` | 変更済み | `ex-ws`/`json` オプション削除済み |
| `src/tests/web/CompileOptions.spec.tsx` | **要修正** | 4 オプションを期待しているが実際は 2 つ |
| `src/interfaces/NospaceTypes.ts` | 変更不要 | `CompileTarget` 型は `WasmExecutionBackend` 等で引き続き使用 |

## 修正方針

テスト側を現在の UI に合わせて修正する。

### 修正内容

`src/tests/web/CompileOptions.spec.tsx` L53:

```diff
- expect(options).toEqual(['ws', 'mnemonic', 'ex-ws', 'json']);
+ expect(options).toEqual(['ws', 'mnemonic']);
```

### 備考

- `CompileTarget` 型（`'ws' | 'mnemonic' | 'ex-ws' | 'json'`）はバックエンド処理（`WasmExecutionBackend.compile()`）で引き続き使用されるため、型の変更は不要
- `compile-output-viewer` タスクで `ex-ws`/`json` オプションが UI に再追加される場合は、テストも再度更新が必要
