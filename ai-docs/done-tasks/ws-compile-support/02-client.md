# クライアントサイド設計

## NospaceSocketClient.ts — emitCompile メソッド

### 新規メソッド

```typescript
/** コンパイルリクエストを送信 */
emitCompile(code: string, options: CompileOptions): void {
  this.requireSocket().emit('nospace_compile', { code, options });
}
```

インポートに `CompileOptions` を追加:

```typescript
import type {
  NospaceClientToServerEvents,
  NospaceServerToClientEvents,
  RunOptions,
  CompileOptions,     // 追加
} from '../../interfaces/NospaceTypes';
```

レスポンスは既存の `nospace_stdout` / `nospace_stderr` / `nospace_execution_status` リスナーで受信するため、受信側の変更は不要。

## ServerExecutionBackend.ts — compile 実装

### compile メソッド

```typescript
compile(code: string, options: CompileOptions): void {
  this.client.emitCompile(code, options);
}
```

現在の実装:
```typescript
compile(_code: string, _options: CompileOptions): void {
  throw new Error('Compile not supported in websocket flavor');
}
```

### capabilities 更新

```typescript
static capabilities: ExecutionBackendCapabilities = {
  supportsInteractiveStdin: true,
  supportsCompile: true,          // false → true
  supportsIgnoreDebug: true,
  supportsLanguageSubsetForRun: true,
  requiresServer: true,
};
```

### コンパイルエラーアノテーション対応

`onCompileErrors` を実装し、stderr からの構造化エラーを通知する。

```typescript
private compileErrorsCallback: ((errors: NospaceErrorEntry[]) => void) | null = null;

onCompileErrors(callback: (errors: NospaceErrorEntry[]) => void): void {
  this.compileErrorsCallback = callback;
}
```

stderr ハンドラに構造化エラー検出を追加:

```typescript
onStderr: (payload) => {
  // 既存: 表示用の整形
  const formatted = tryFormatNospaceErrorJson(payload.data);
  this.outputCallback?.({
    type: 'stderr',
    data: formatted ?? payload.data,
    timestamp: Date.now(),
  });

  // 追加: 構造化エラーをコールバックに渡す
  const parsed = tryParseNospaceErrors(payload.data);
  if (parsed) {
    this.compileErrorsCallback?.(parsed);
  }
},
```

`tryParseNospaceErrors` は `formatNospaceErrors.ts` の `isNospaceErrorResult` を使って実装:

```typescript
// formatNospaceErrors.ts に追加
export function tryParseNospaceErrors(text: string): NospaceErrorEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isNospaceErrorResult(parsed)) {
    return null;
  }
  return parsed.errors;
}
```

### 注意事項

- `compileErrorsCallback` は run エラー時にも呼ばれる（WASM 版と同じ動作）。`useNospaceExecution` が `handleRun` / `handleCompile` 開始時に `setCompileErrors([])` でクリアするため問題ない。
- stderr が複数チャンクに分割される場合、JSON パースは失敗する。この制限は既存の run 時エラー表示と同じであり、本タスクのスコープ外。

## ExecutionContainer.tsx — UI 変更

### コンパイルモードの有効化

現在:
```tsx
const supportsCompileMode = isWasm;
```

変更後:
```tsx
const supportsCompileMode = true;
```

これにより、WebSocket flavor でも Compile タブが表示される。

### モードタブ表示条件

変更後の `showModeTabs` 判定:
```tsx
const showModeTabs = supportsCompileMode || supportsTestEditor;
// supportsCompileMode = true, supportsTestEditor = isWebSocket
// → 常に showModeTabs = true
```

### Compile モード切り替え時の強制リセット

現在の `useEffect`:
```tsx
useEffect(() => {
  if (!supportsCompileMode && operationMode === 'compile') {
    setOperationMode('execution');
  }
  // ...
}, [supportsCompileMode, supportsTestEditor]);
```

`supportsCompileMode` が常に `true` になるため、この条件は不要になるが、将来的な拡張性のため残す。

### CompileOptions ターゲット選択肢

`CompileOptions` コンポーネントのデフォルトターゲット選択肢は `ws` / `mnemonic`。これは CLI がサポートする `ws` / `mnemonic` / `json` のサブセットであり、WebSocket flavor でも問題なく動作する。

`ex-ws` ターゲットは CLI 未対応だが、デフォルト選択肢に含まれていないため対応不要。将来的に `ex-ws` をUI に追加する場合は、flavor に応じたフィルタリングが必要。

### InputPanel の forceBatchMode

Compile モードの InputPanel は `forceBatchMode={true}` で固定されている。WebSocket flavor でもコンパイル時は stdin 不要のため、この設定で正しい。コンパイル結果の実行時は `handleRunCompileOutput` が `inputMode: 'batch'` で run を呼ぶため、バッチモード固定で動作する。

ただし WebSocket flavor の場合、コンパイル結果の実行時に interactive stdin を使えると便利な可能性がある。この拡張は将来タスクとする。

## テスト

### NospaceSocketClient.spec.ts

追加テストケース:

| テスト | 内容 |
|---|---|
| `emitCompile でコンパイルリクエストを送信する` | `socket.emit('nospace_compile', ...)` の呼び出し検証 |

### ServerExecutionBackend.spec.ts

追加・変更テストケース:

| テスト | 内容 |
|---|---|
| `compile でクライアントの emitCompile を呼び出す` | `client.emitCompile(code, options)` の呼び出し検証 |
| `compile がエラーをスローしない` | 既存の throw テストを削除/更新 |
| `capabilities.supportsCompile が true` | 既存テスト更新 |
| `stderr の JSON エラーで compileErrorsCallback が呼ばれる` | 構造化エラーのアノテーション通知検証 |
| `stderr の非 JSON データで compileErrorsCallback が呼ばれない` | 通常テキストの場合は無視 |

### formatNospaceErrors.spec.ts

追加テストケース:

| テスト | 内容 |
|---|---|
| `tryParseNospaceErrors で JSON エラーをパースする` | 正常ケース |
| `tryParseNospaceErrors で非 JSON を null に返す` | パース失敗ケース |
| `tryParseNospaceErrors で不正なフォーマットを null に返す` | 型不一致ケース |
