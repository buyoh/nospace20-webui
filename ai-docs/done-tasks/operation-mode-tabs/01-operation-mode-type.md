# 01: OperationMode 型・atom・デフォルト値の変更

## 対象ファイル

- `src/web/stores/testEditorAtom.ts`

## 変更内容

### OperationMode 型の変更

```typescript
// Before
export type OperationMode = 'execution' | 'compile' | 'test-editor';

// After
export type OperationMode = 'compile' | 'run' | 'run-direct' | 'test-editor';
```

### デフォルト値

```typescript
// Before
export const operationModeAtom = atom<OperationMode>('execution');

// After
export const operationModeAtom = atom<OperationMode>('compile');
```

デフォルトを `'compile'` にする理由:
- WASM flavor で最初に表示されるタブとして適切
- WebSocket flavor でも「まずコンパイル→結果確認→実行」のワークフローに合う

## 影響範囲

`OperationMode` 型を参照する全箇所で `'execution'` → `'run-direct'` への置換が必要:

- `src/web/containers/ExecutionContainer.tsx` — タブ切り替え・条件分岐（02 で対応）
- `src/tests/web/` 配下のテストファイル（もしあれば）

## テスト観点

- `operationModeAtom` の初期値が `'compile'` であること
- `OperationMode` 型が `'compile' | 'run' | 'run-direct' | 'test-editor'` であること
