# テスト失敗の調査と修正計画

**作成日**: 2026-02-11
**ステータス**: 調査完了・修正待ち

## 概要

`npm test` の実行により2つのテストが失敗していることが判明。本ドキュメントでは失敗の原因分析と修正方針を記述する。

## 実行結果サマリー

- **合計テスト**: 24個
- **成功**: 22個
- **失敗**: 2個
- **Test Suites**: 3個中2個失敗

## 失敗テスト詳細

### 1. CodeTextarea.spec.tsx - 変更時にonChangeが呼ばれる

**ファイル**: `src/tests/web/CodeTextarea.spec.tsx:39`

#### エラー内容

```
expect(jest.fn()).toHaveBeenCalled()

Expected number of calls: >= 1
Received number of calls:    0
```

#### 原因分析

テストコード（L34-38）:
```tsx
const newValue = 'test';
textarea.value = newValue;
textarea.dispatchEvent(new Event('change', { bubbles: true }));
```

実装（CodeTextarea.tsx L41）:
```tsx
onChange={(e) => onChange(e.target.value)}
```

**問題点**:
- テストでネイティブDOM APIの `dispatchEvent` を使用しているが、Reactの合成イベントシステムではこれが`onChange`ハンドラをトリガーしない
- `@testing-library/react` を使用する場合、`fireEvent` または `userEvent` を使用する必要がある

#### 修正方針

`@testing-library/react` の `fireEvent.change()` または `@testing-library/user-event` の `user.type()` を使用してイベントをトリガーする。

**修正例**:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
// または
import userEvent from '@testing-library/user-event';

// Option 1: fireEvent を使用
fireEvent.change(textarea, { target: { value: newValue } });

// Option 2: userEvent を使用（より推奨）
await userEvent.clear(textarea);
await userEvent.type(textarea, newValue);
```

### 2. NospaceExecutionService.spec.ts - コマンド引数が正しく構築される

**ファイル**: `src/tests/app/NospaceExecutionService.spec.ts:258`

#### エラー内容

```
expect(jest.fn()).toHaveBeenCalledWith(...expected)

Expected: "/fake/path/to/wsc", ArrayContaining ["--std", "whitespace", "--debug", "--ignore-debug"]
Received: "/fake/path/to/wsc", ["--std", "ws", "--debug", "--ignore-debug", "tmp/nospace-f523c081-8bdd-46db-941f-9b0f88778cc1.ns"]
```

#### 原因分析

テストコード（L241-247）:
```typescript
const options: RunOptions = {
  language: 'ws',          // ← 'ws' を指定
  debug: true,
  ignoreDebug: true,
  inputMode: 'interactive',
};
```

期待値（L258-265）:
```typescript
expect(fakeSpawner.spawn).toHaveBeenCalledWith(
  fakeConfig.nospaceBinPath,
  expect.arrayContaining([
    '--std',
    'whitespace',     // ← 'whitespace' を期待
    '--debug',
    '--ignore-debug',
  ])
);
```

実装（NospaceExecutionService.ts L197）:
```typescript
args.push('--std', options.language);
```

**問題点**:
- テストで `language: 'ws'` を指定しているが、期待値として `'whitespace'` をチェックしている
- 実装は `options.language` の値をそのまま使用するため、`'ws'` が渡される
- テストの期待値が実際の動作と一致していない

#### 修正方針

テストの期待値を実際の値（`'ws'`）に修正する。

**修正例**:
```typescript
expect(fakeSpawner.spawn).toHaveBeenCalledWith(
  fakeConfig.nospaceBinPath,
  expect.arrayContaining([
    '--std',
    'ws',  // 'whitespace' → 'ws' に修正
    '--debug',
    '--ignore-debug',
  ])
);
```

**代替案**: もし `'ws'` を `'whitespace'` に変換する必要がある場合は、実装側で言語名のマッピングを追加する。ただし、他のテストケース（L219-237）では `'standard'` がそのまま使われているため、マッピングは不要と判断。

## カバレッジ状況

テスト失敗により一部カバレッジが低くなっている:

- **CodeTextarea.tsx**: 36.84% (L17-33, 43がカバーされていない)
  - onChange関連のロジックが正しくテストされていないため
- **NospaceExecutionService.ts**: 94.18%
  - 全体的には良好だが、一部のエラーハンドリングパス（L128-129, 153, 180）がカバーされていない

## 修正優先度

1. **高**: NospaceExecutionService.spec.ts の修正（簡単な期待値の変更のみ）
2. **中**: CodeTextarea.spec.tsx の修正（テストライブラリの正しい使用方法へ変更）

## 次のステップ

1. 上記2つのテストを修正
2. テストを再実行して全てパスすることを確認
3. カバレッジレポートを確認
4. 必要に応じて追加のテストケースを実装

## 参考リンク

- [@testing-library/react Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [@testing-library/user-event](https://testing-library.com/docs/user-event/intro)
- [Jest expect.arrayContaining](https://jestjs.io/docs/expect#expectarraycontainingarray)
