# 問題 3: デッドコードおよびテストの不整合

## 関連ルール

> Unitテストはモジュールごとに作成する

テストの対象モジュールが既に使われていない、またはテストが旧 API を対象としている場合、テストとしての意味をなさない。

## 現状

### 3-A: `useNospaceSocket.ts` がデッドコード

`useNospaceExecution.ts` が `ExecutionBackend` 抽象を使う形にリファクタリングされた結果、
`useNospaceSocket` フックはプロダクションコードから一切 import されていない。

wasm-flavor タスク（`ai-docs/tasks/wasm-flavor/03-frontend-integration.md`）にて削除が計画されているが、未実施。

**確認結果**: `src/web/` 配下で `useNospaceSocket` を import しているファイルはゼロ。

### 3-B: `socketAtom.ts` の大部分がデッドコード

`socketAtom.ts` で定義されている以下は `useNospaceSocket.ts` からのみ参照される:
- `socketAtom`
- `connectionStatusAtom`
- `connectionErrorAtom`
- `createSocket()`

`AppSocket` type は `useNospaceExecution.spec.tsx`（テスト）からも参照されているが、
テスト自体が旧 API をテストしているため、テストの修正と合わせて不要になる。

### 3-C: `useNospaceExecution.spec.tsx` が旧 API をテスト

テストは `jest.mock('../../web/hooks/useNospaceSocket')` で `useNospaceSocket` をモックし、
socket に直接 `emit` される前提でアサーションを行っている。

しかし現在の `useNospaceExecution` 実装は:
- `useNospaceSocket` を使用しない
- `ExecutionBackend` インターフェースを介して実行を制御
- `ServerExecutionBackend` を動的 import で生成

そのため、テストは実装と乖離しており、正しい動作を検証できていない。

### 3-D: `useNospaceSocket.spec.tsx` がデッドコードのテスト

`useNospaceSocket` 自体がデッドコードのため、そのテストも不要。

## 修正方針

### Step 1: デッドコードの削除

以下のファイルを `.trash/` に移動:
- `src/web/hooks/useNospaceSocket.ts`
- `src/tests/web/useNospaceSocket.spec.tsx`

### Step 2: `socketAtom.ts` の整理

`useNospaceSocket` 削除後、以下を `.trash/` に移動または削除:
- `socketAtom` atom
- `connectionStatusAtom` atom
- `connectionErrorAtom` atom
- `createSocket()` 関数

`AppSocket` type は `ServerExecutionBackend.ts` でも定義されているため、
共通の型定義は `NospaceTypes.ts` 等に移動するか、`ServerExecutionBackend.ts` 内でのみ定義する。

### Step 3: `useNospaceExecution.spec.tsx` の全面書き換え

問題 1 の修正（`useNospaceExecution` への backend factory DI 導入）と合わせて、
テストを現在の実装に合わせて書き直す。

## 影響範囲

- `src/web/hooks/useNospaceSocket.ts` : 削除
- `src/web/stores/socketAtom.ts` : 大幅削減 or 削除
- `src/tests/web/useNospaceSocket.spec.tsx` : 削除
- `src/tests/web/useNospaceExecution.spec.tsx` : 全面書き換え
