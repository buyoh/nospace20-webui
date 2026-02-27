# テスト失敗調査: オプションデフォルト値変更・Optimization UI 変更

## 概要

以下の機能変更に伴い、`CompileOptions.spec.tsx` で 3 件のテストが新たに失敗した。

- `language` デフォルト値を `'standard'` → `'ws'` に変更
- `stdExtensions` デフォルト値を `[]` → `['alloc']` に変更
- `optPasses` デフォルト値を `[]` → `['all']` に変更
- Optimization セクションで `'all'` 以外の項目を collapsed `CollapsibleSection` 内に格納

## 失敗テスト一覧

### 1. `CompileOptions > Language セレクターが表示される`

**ファイル**: `src/tests/web/CompileOptions.spec.tsx`
**原因**: テストがデフォルト値 `'standard'` を期待しているが、デフォルトが `'ws'` に変更されたため。
**対応**: デフォルト値の expectation を `'ws'` に更新する必要がある。

### 2. `CompileOptions > Opt Passes > optPassOptions チェックボックスが表示される`

**ファイル**: `src/tests/web/CompileOptions.spec.tsx`
**原因**: テストが `['all', 'condition-opt']` を渡し、`'Condition Opt'` ラベルを `getByLabelText` で検索しているが、`'condition-opt'` は `'all'` 以外のため collapsed `CollapsibleSection`（"More"）内に入り、DOM に表示されていない状態。
**対応**: `'All'` のみ visible であることを確認するか、展開後の状態でテストする必要がある。

### 3. `CompileOptions > Opt Passes > props で optPassOptions を注入できる`

**ファイル**: `src/tests/web/CompileOptions.spec.tsx`
**原因**: テストが `['custom-pass']` を渡し直接 `getByLabelText('custom-pass')` を検索しているが、`'custom-pass'` は `'all'` ではないため collapsed 内に入り非表示。
**対応**: `'all'` 以外の項目が "More" セクション内に入ることを前提にテストを修正する必要がある。

## まとめ

いずれの失敗も仕様変更に伴う意図的なデフォルト値・UI 構造の変更が原因。既存テストの期待値を新仕様に合わせて更新することで解消できる。
