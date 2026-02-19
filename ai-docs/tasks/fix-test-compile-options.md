# テスト失敗修正: CompileOptions テストの依存性注入対応

## 概要

`CompileOptions.spec.tsx` の「Target セレクターに全てのオプションが含まれる」テストが失敗している。
UI コンポーネントからオプションが削除されたがテストが追随していないことが直接的な原因。

根本的な問題は **テストが具体的なオプション一覧をハードコードしている** こと。
選択肢は今後も頻繁に変更されるため、テストの目的を明確にし依存性注入で差し替えられる設計にする。

## 失敗内容

- **テストファイル**: `src/tests/web/CompileOptions.spec.tsx`
- **テスト名**: `Target セレクターに全てのオプションが含まれる`
- **エラー**:
  ```
  Expected: ['ws', 'mnemonic', 'ex-ws', 'json']
  Received: ['ws', 'mnemonic']
  ```

## 原因

コミット `b6157f7`（"Remove extended whitespace and json"）にて、`CompileOptions.tsx` の Target セレクターから `ex-ws`/`json` の `<option>` が意図的に削除されたが、テスト側が未更新。

## 全 UI テストの分析

### 問題のあるテスト

| テスト | 問題 | 種類 |
|--------|------|------|
| `CompileOptions.spec.tsx` "Target セレクターに全てのオプションが含まれる" | Target オプション一覧をハードコード | **ハードコード** |
| `CompileOptions.spec.tsx` "Language セレクターに全てのオプションが含まれる" | Language オプション一覧をハードコード | **ハードコード** |

### 問題のないテスト

| テスト | 理由 |
|--------|------|
| `CompileOptions.spec.tsx` セレクター表示・変更テスト | デフォルト値と変更動作のみ。UIの振る舞いテストとして適切 |
| `Header.spec.tsx` | `setApplicationFlavor()` で環境を注入、`availableFlavorsAtom` は computed atom。テスト設計が良好 |
| `CodeTextarea.spec.tsx` | props 経由で全データを注入。依存性注入が既に適用されている |
| `ExecutionControls.spec.tsx` | props 経由で全コールバックとフラグを注入。ハードコードなし |
| `CompileOutputPanel.spec.tsx` | props 経由で全データを注入。ハードコードなし |

## テスト目的の整理

`CompileOptions.spec.tsx` の各テストが検証すべき目的:

| テスト | 目的 | あるべき姿 |
|--------|------|-----------|
| セレクターが表示される | UI 要素の存在確認 | 現状のまま（OK） |
| デフォルト値が正しい | 初期値の動作確認 | 現状のまま（OK） |
| 全てのオプションが含まれる | **選択肢のレンダリング動作** | 選択肢をコンポーネント外から注入 |
| 値を変更できる | ユーザー操作によるstate変更 | 現状のまま（OK） |

## 修正方針

### 1. CompileOptions コンポーネントに選択肢を props で注入可能にする

```tsx
/** 選択肢の定義 */
interface OptionItem<T extends string> {
  value: T;
  label: string;
}

/** CompileOptions の Props。省略時はデフォルト値を使用 */
interface CompileOptionsProps {
  languageOptions?: OptionItem<LanguageSubset>[];
  targetOptions?: OptionItem<CompileTarget>[];
}

/** デフォルトの Language 選択肢 */
const DEFAULT_LANGUAGE_OPTIONS: OptionItem<LanguageSubset>[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'min', label: 'Minimal' },
  { value: 'ws', label: 'Whitespace' },
];

/** デフォルトの Target 選択肢 */
const DEFAULT_TARGET_OPTIONS: OptionItem<CompileTarget>[] = [
  { value: 'ws', label: 'Whitespace' },
  { value: 'mnemonic', label: 'Mnemonic' },
];

export const CompileOptions: React.FC<CompileOptionsProps> = ({
  languageOptions = DEFAULT_LANGUAGE_OPTIONS,
  targetOptions = DEFAULT_TARGET_OPTIONS,
}) => {
  // ...select 内で .map() して option を生成
};
```

### 2. テストを依存性注入方式に修正

```tsx
const testLanguageOptions = [
  { value: 'standard' as const, label: 'Standard' },
  { value: 'min' as const, label: 'Minimal' },
];

const testTargetOptions = [
  { value: 'ws' as const, label: 'WS' },
  { value: 'mnemonic' as const, label: 'Mnemonic' },
  { value: 'ex-ws' as const, label: 'Extended' },
];

it('Target セレクターに指定した全てのオプションが含まれる', () => {
  render(
    <Provider>
      <CompileOptions targetOptions={testTargetOptions} />
    </Provider>
  );
  const targetSelect = screen.getByLabelText(/Target:/i) as HTMLSelectElement;
  const options = Array.from(targetSelect.options).map(o => o.value);
  expect(options).toEqual(['ws', 'mnemonic', 'ex-ws']);
});
```

### 3. 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/web/components/execution/CompileOptions.tsx` | Props で `languageOptions`/`targetOptions` を受け取れるようにする |
| `src/tests/web/CompileOptions.spec.tsx` | 選択肢テストをテストデータ注入方式に変更 |

### 備考

- `CompileTarget` 型（`'ws' | 'mnemonic' | 'ex-ws' | 'json'`）はバックエンド処理で使用されるため型の変更は不要
- Props を省略した場合は現在と同じデフォルト選択肢を使用（既存の呼び出し元への影響なし）
- `compile-output-viewer` タスク等で選択肢が増えた場合もテストは壊れない
