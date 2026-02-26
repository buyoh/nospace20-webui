# 共通 UI コンポーネント抽出（Button / Select / TextInput / Textarea / Checkbox / RadioGroup）

## 概要

button・select・input・textarea・checkbox・radio の CSS 設定が各コンポーネントの SCSS に分散している。
各要素を React コンポーネントとしてラップし、スタイルを一か所に集約する。

## 現状の問題

### ボタンスタイルの散在

以下の 8 ファイルでボタンのスタイルが個別定義されている:

| ファイル | クラス名 | カラー | 用途 |
|---|---|---|---|
| ExecutionControls.scss | `.btn-run` | success (緑) | 実行 |
| ExecutionControls.scss | `.btn-kill` | danger (赤) | 停止 |
| ExecutionControls.scss | `.btn-compile` | accent-blue | コンパイル |
| InputPanel.scss | `.btn-send` | success (緑) | stdin 送信 |
| CompileOutputPanel.scss | `.btn-run-compiled` | success (緑) | コンパイル済み実行 |
| OutputPanel.scss | `.btn-clear` | bg-input (灰) | 出力クリア |
| TestCaseEditForm.scss | `.btn-save` / `.btn-create` | success (緑) | 保存・作成 |
| TestCaseEditForm.scss | `.btn-cancel` | bg-button-secondary | キャンセル |
| TestListPanel.scss | `.btn-new-test` | accent-primary (青) | テスト新規作成 |
| CheckResultEditor.scss | `.array-item button` | bg-input + error-text | 削除 |
| CheckResultEditor.scss | `.array-editor > button` | bg-input | 追加 |
| CheckResultEditor.scss | `.multi-cases > button` | bg-input | ケース追加 |
| ExecutionContainer.scss | `.mode-tab` | transparent + border-bottom | タブ切替 |

**共通パターン**: `border: none; border-radius: 3-4px; cursor: pointer; &:disabled { opacity: 0.5; cursor: not-allowed; }`

**バリアント別の共通パターン**:
- **success (緑)**: `.btn-run`, `.btn-send`, `.btn-save`, `.btn-create`, `.btn-run-compiled` — 同一の `background-color: $success; color: white; &:hover:not(:disabled) { background-color: $success-hover; }`
- **danger (赤)**: `.btn-kill` — `$danger` / `$danger-hover`
- **accent (青)**: `.btn-compile`, `.btn-new-test` — `$accent-blue-dark` or `$accent-primary` / `$accent-blue-hover`
- **secondary (灰)**: `.btn-cancel` — `$bg-button-secondary` / `$bg-button-secondary-hover`
- **outline (枠線)**: `.btn-clear`, array editor buttons — `border: 1px solid $border-secondary; background-color: $bg-input`

### select スタイルの散在

3 箇所で類似のスタイルが独立定義:

| ファイル | セレクタ | 差異 |
|---|---|---|
| CompileOptions.scss | `.option-group select` | `padding: 0.25rem; font-size: 0.85rem` |
| ExecutionOptions.scss | `.option-group select` | 同上（ほぼ同一） |
| TestCaseEditForm.scss | `.form-section select` | `width: 100%; padding: 8px; font-size: 14px` |
| CheckResultEditor.scss | `.check-result-type-selector` | `padding: 4px 8px; font-size: 13px` |

**共通パターン**: `background-color: $bg-input; color: $text-primary; border: 1px solid $border-secondary; border-radius: 3-4px; &:focus { outline: none; border-color: $accent-primary; }`

### input スタイルの散在

5 箇所以上:

| ファイル | セレクタ | 種別 |
|---|---|---|
| ExecutionOptions.scss | `.option-group input[type='number']` | number |
| TestCaseEditForm.scss | `.form-section input` | text |
| CheckResultEditor.scss | `.array-item input[type='text']`, `input[type='number']` | text/number |
| InputPanel.scss | `.interactive-input` | text（monospace） |
| CheckResultEditor.scss | `.case-header input[type='text']` | text |

**共通パターン**: `background-color: $bg-input; color: $text-primary; border: 1px solid $border-secondary; border-radius: 3-4px; &:focus { outline: none; border-color: $accent-primary; } &:disabled { opacity: 0.5 or background-color: $bg-tertiary; color: $text-muted; }`

### textarea スタイルの散在

4 箇所:

| ファイル | セレクタ | 特徴 |
|---|---|---|
| InputPanel.scss | `.batch-input` | monospace, resize: vertical |
| CheckResultEditor.scss | `.json-editor` | monospace, resize: vertical |
| CheckResultEditor.scss (IO form) | `.success-io-form textarea` | monospace, resize: vertical |
| TestCaseEditForm.scss | `.form-section textarea` | monospace, resize: vertical |

**共通パターン**: `font-family: 'Courier New', monospace; background-color: $bg-primary or $bg-input; color: $text-primary; border: 1px solid $border-secondary; border-radius: 4px; resize: vertical; &:focus { outline: none; border-color: $accent-primary; }`

### checkbox スタイルの散在

1 箇所:

| ファイル | セレクタ | 用途 |
|---|---|---|
| ExecutionOptions.tsx | `<input type="checkbox">` × 2 | debug / ignoreDebug オプション |
| ExecutionOptions.scss | `.option-group input[type='checkbox'] { cursor: pointer; }` | — |

現時点では 1 ファイルのみだが、`<label>` + checkbox + テキストの組み合わせパターンは今後も再利用されうるため、コンポーネント化しておく。

### radio グループスタイルの散在

3 箇所で同一の「ラジオボタングループ」パターンが独立実装されている:

| ファイル (TSX) | SCSS セレクタ | 用途 |
|---|---|---|
| `CheckResultEditor.tsx` (`CheckResultModeToggle`) | `.check-result-mode-toggle` | Form / JSON Text 切替 |
| `SuccessIOForm.tsx` | `.mode-selector` | Single Case / Multiple Cases 切替 |
| `ParseErrorForm.tsx` | `.radio-group` | Tree / Tokenize 切替 |

**共通パターン**: `display: flex; gap: 12-16px; font-size: 13px;` + `label { display: flex; align-items: center; gap: 4px; cursor: pointer; font-weight: normal; }`

3 箇所とも「横並びラジオボタン + テキストラベル」の同一 UI パターンで、SCSS も `display: flex; gap; font-size; label { display: flex; align-items: center; gap; cursor: pointer; }` がほぼ同一。

## 設計

### ディレクトリ構造

```
src/web/components/common/
├── Button.tsx
├── Checkbox.tsx
├── RadioGroup.tsx
├── Select.tsx
├── TextInput.tsx
├── Textarea.tsx
└── styles/
    ├── Button.scss
    ├── Checkbox.scss
    ├── RadioGroup.scss
    ├── Select.scss
    ├── TextInput.scss
    └── Textarea.scss
```

### A. `Button` コンポーネント

```tsx
type ButtonVariant = 'primary' | 'danger' | 'accent' | 'secondary' | 'outline';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;   // デフォルト: 'primary'
  size?: ButtonSize;         // デフォルト: 'md'
}
```

- ネイティブ `<button>` をラップし、`className` に `btn btn-{variant} btn-{size}` を付与。
- 呼び出し元から渡された `className` はマージする。
- すべての HTML button 属性を透過（`disabled`, `onClick`, `type` 等）。

**レンダリング**:

```tsx
<button
  className={`btn btn-${variant} btn-${size} ${className ?? ''}`}
  {...rest}
>
  {children}
</button>
```

**SCSS（Button.scss）**:

```scss
.btn {
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // サイズ
  &.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
  &.btn-md { padding: 0.5rem 1rem; font-size: 0.9rem; }

  // バリアント
  &.btn-primary {
    background-color: colors.$success;
    color: white;
    &:hover:not(:disabled) { background-color: colors.$success-hover; }
  }
  &.btn-danger {
    background-color: colors.$danger;
    color: white;
    &:hover:not(:disabled) { background-color: colors.$danger-hover; }
  }
  &.btn-accent {
    background-color: colors.$accent-blue-dark;
    color: white;
    &:hover:not(:disabled) { background-color: colors.$accent-blue-hover; }
  }
  &.btn-secondary {
    background-color: colors.$bg-button-secondary;
    color: colors.$text-primary;
    &:hover:not(:disabled) { background-color: colors.$bg-button-secondary-hover; }
  }
  &.btn-outline {
    background-color: colors.$bg-input;
    color: colors.$text-primary;
    border: 1px solid colors.$border-secondary;
    &:hover:not(:disabled) { background-color: colors.$bg-input-hover; }
  }
}
```

### B. `Select` コンポーネント

```tsx
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  // 標準 HTML select 属性のみ。追加 props 不要。
}
```

- ネイティブ `<select>` をラップ。`className` に `common-select` を付与。
- `children`（`<option>` 要素）はそのまま透過。

**レンダリング**:

```tsx
<select className={`common-select ${className ?? ''}`} {...rest}>
  {children}
</select>
```

**SCSS（Select.scss）**:

```scss
.common-select {
  padding: 0.25rem;
  background-color: colors.$bg-input;
  color: colors.$text-primary;
  border: 1px solid colors.$border-secondary;
  border-radius: 3px;
  font-size: 0.85rem;
  cursor: pointer;

  &:hover { border-color: colors.$accent-primary; }
  &:focus { outline: none; border-color: colors.$accent-primary; }
  &:disabled {
    background-color: colors.$bg-tertiary;
    color: colors.$text-muted;
    cursor: not-allowed;
  }
}
```

### C. `TextInput` コンポーネント

```tsx
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // 標準 HTML input 属性のみ。type は 'text' | 'number' 等を自由に設定可能。
}
```

- ネイティブ `<input>` をラップ。`className` に `common-text-input` を付与。

**レンダリング**:

```tsx
<input className={`common-text-input ${className ?? ''}`} {...rest} />
```

**SCSS（TextInput.scss）**:

```scss
.common-text-input {
  padding: 0.25rem;
  background-color: colors.$bg-input;
  color: colors.$text-primary;
  border: 1px solid colors.$border-secondary;
  border-radius: 3px;
  font-size: 0.85rem;

  &:focus { outline: none; border-color: colors.$accent-primary; }
  &:disabled {
    background-color: colors.$bg-tertiary;
    color: colors.$text-muted;
    cursor: not-allowed;
  }
}
```

### D. `Textarea` コンポーネント

```tsx
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // 標準 HTML textarea 属性のみ。
}
```

- ネイティブ `<textarea>` をラップ。`className` に `common-textarea` を付与。

**レンダリング**:

```tsx
<textarea className={`common-textarea ${className ?? ''}`} {...rest} />
```

**SCSS（Textarea.scss）**:

```scss
.common-textarea {
  width: 100%;
  padding: 0.5rem;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  background-color: colors.$bg-primary;
  color: colors.$text-primary;
  border: 1px solid colors.$border-secondary;
  border-radius: 4px;
  resize: vertical;
  box-sizing: border-box;

  &:focus { outline: none; border-color: colors.$accent-primary; }
  &:disabled {
    background-color: colors.$bg-secondary;
    color: colors.$text-muted;
    cursor: not-allowed;
  }
}
```

### E. `Checkbox` コンポーネント

```tsx
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** チェックボックスの横に表示するラベルテキスト */
  label: string;
}
```

- `<label>` + `<input type="checkbox">` + テキストを 1 つのコンポーネントにまとめる。
- テキスト入力用の `TextInput` とは体系が異なるため別コンポーネント。

**レンダリング**:

```tsx
<label className={`common-checkbox ${className ?? ''}`}>
  <input type="checkbox" {...rest} />
  <span>{label}</span>
</label>
```

**SCSS（Checkbox.scss）**:

```scss
.common-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;

  input[type='checkbox'] {
    cursor: pointer;
  }

  span {
    min-width: 80px;
  }
}
```

### F. `RadioGroup` コンポーネント

```tsx
interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string> {
  /** グループ名（HTML name 属性） */
  name: string;
  /** 選択肢 */
  options: RadioOption<T>[];
  /** 現在選択中の値 */
  value: T;
  /** 選択変更時コールバック */
  onChange: (value: T) => void;
  /** 無効化 */
  disabled?: boolean;
  /** 追加クラス */
  className?: string;
}
```

- 3 箇所のラジオボタングループ UI を統一する。
- 各ラジオボタン + ラベルの組み合わせを `options` 配列で定義しレンダリング。

**レンダリング**:

```tsx
<div className={`common-radio-group ${className ?? ''}`}>
  {options.map((opt) => (
    <label key={opt.value}>
      <input
        type="radio"
        name={name}
        value={opt.value}
        checked={value === opt.value}
        onChange={() => onChange(opt.value)}
        disabled={disabled}
      />
      {opt.label}
    </label>
  ))}
</div>
```

**SCSS（RadioGroup.scss）**:

```scss
.common-radio-group {
  display: flex;
  gap: 16px;
  font-size: 13px;

  label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-weight: normal;

    input[type='radio'] {
      margin: 0;
      cursor: pointer;
    }
  }
}
```

## リファクタリング対象

### Button 置き換え

| ファイル（TSX） | 変更内容 |
|---|---|
| `ExecutionControls.tsx` | `<button className="btn-run">` → `<Button variant="primary">` 等 |
| `InputPanel.tsx` | `<button className="btn-send">` → `<Button variant="primary" size="md">` |
| `CompileOutputPanel.tsx` | `<button className="btn-run-compiled">` → `<Button variant="primary" size="sm">` |
| `OutputPanel.tsx` | `<button className="btn-clear">` → `<Button variant="outline" size="sm">` |
| `TestCaseEditForm.tsx` | `.btn-save` → `<Button variant="primary">` |
| `TestCaseCreateForm.tsx` | `.btn-create` → `<Button variant="primary">`, `.btn-cancel` → `<Button variant="secondary">` |
| `TestListPanel.tsx` | `.btn-new-test` → `<Button variant="accent">` |
| `CheckResultEditor.scss` 関連 | array item 削除ボタン → `<Button variant="outline">`, 追加ボタン → `<Button variant="outline">` |

**対象外**:
- `.mode-tab`（ExecutionContainer）: タブ UI は `Button` コンポーネントの用途外。独自のタブコンポーネントが適切だが、現時点では 1 箇所のみのためそのまま維持。
- `.options-header` / `.collapse-toggle` (折りたたみヘッダー): `extract-collapsible-section` タスクで `CollapsibleSection` コンポーネントに移行予定。

### Select 置き換え

| ファイル（TSX） | 変更内容 |
|---|---|
| `CompileOptions.tsx` | `<select>` → `<Select>` |
| `ExecutionOptions.tsx` | `<select>` → `<Select>` |
| `TestCaseCreateForm.tsx` | `<select>` → `<Select>` |
| `CheckResultEditor.tsx` | `<select className="check-result-type-selector">` → `<Select>` |

### TextInput 置き換え

| ファイル（TSX） | 変更内容 |
|---|---|
| `ExecutionOptions.tsx` | `<input type="number">` → `<TextInput type="number">` |
| `InputPanel.tsx` | `<input type="text" className="interactive-input">` → `<TextInput>` |
| `TestCaseCreateForm.tsx` | `<input type="text">` → `<TextInput>` |
| `CheckResultEditor.tsx` 関連フォーム | array item の `<input>` → `<TextInput>` |

### Checkbox 置き換え

| ファイル（TSX） | 変更内容 |
|---|---|
| `ExecutionOptions.tsx` | `<label><input type="checkbox" ...><span>Debug trace</span></label>` → `<Checkbox label="Debug trace (--debug)" ...>` |
| `ExecutionOptions.tsx` | `<label><input type="checkbox" ...><span>Ignore debug...</span></label>` → `<Checkbox label="Ignore debug functions (--ignore-debug)" ...>` |

### RadioGroup 置き換え

| ファイル（TSX） | 変更内容 |
|---|---|
| `CheckResultEditor.tsx` (`CheckResultModeToggle`) | `<div className="check-result-mode-toggle"><label><input type="radio">...</label>...</div>` → `<RadioGroup name="edit-mode" options={[{value:'form',label:'Form'},{value:'json',label:'JSON Text'}]} ...>` |
| `SuccessIOForm.tsx` | `.mode-selector` 内のラジオボタン → `<RadioGroup name="io-mode" options={[{value:'single',label:'Single Case'},{value:'multi',label:'Multiple Cases'}]} ...>` |
| `ParseErrorForm.tsx` | `.radio-group` 内のラジオボタン → `<RadioGroup name="phase" options={[{value:'tree',label:'Tree'},{value:'tokenize',label:'Tokenize'}]} ...>` |

### Textarea 置き換え

| ファイル（TSX） | 変更内容 |
|---|---|
| `InputPanel.tsx` | `<textarea className="batch-input">` → `<Textarea>` |
| `CheckResultEditor.tsx` | `.json-editor` textarea → `<Textarea>` |
| `SuccessIOForm.tsx` | textarea → `<Textarea>` |

**対象外**:
- `TestCaseEditForm.tsx` / `TestCaseCreateForm.tsx`: `.form-section textarea` は `CheckResultEditor` 内で使用されるため、CheckResultEditor 側の変更で間接的にカバーされる。ただし直接 textarea を含まないので変更不要。
- `CompileOutputPanel.tsx`: `.compile-output-textarea` は読み取り専用の特殊用途（readOnly, resize: none, cursor: default）。共通 `Textarea` の用途外。

## SCSS 変更

各コンポーネント SCSS ファイルから、共通コンポーネントに移行したスタイルを削除する。

| SCSS ファイル | 削除するスタイル |
|---|---|
| ExecutionControls.scss | `button { ... }`, `.btn-run`, `.btn-kill`, `.btn-compile` の全スタイル |
| InputPanel.scss | `.btn-send`, `.interactive-input`, `.batch-input` のスタイル |
| CompileOutputPanel.scss | `.btn-run-compiled` のスタイル |
| OutputPanel.scss | `.btn-clear` のスタイル |
| CompileOptions.scss | `.option-group select` のスタイル |
| ExecutionOptions.scss | `.option-group select`, `input[type='number']`, `input[type='checkbox']` のスタイル |
| TestCaseEditForm.scss | `.form-footer button`, `.form-section input`, `.form-section select` のスタイル |
| TestListPanel.scss | `.btn-new-test` のスタイル |
| CheckResultEditor.scss | `.array-item button`, `.array-editor > button`, `.multi-cases > button`, `.array-item input`, `.case-header input`, `.check-result-type-selector`, `.json-editor`, `.success-io-form textarea`, `.check-result-mode-toggle`, `.mode-selector`, `.radio-group` のスタイル |

## テスト

### 新規テスト

| ファイル | 内容 |
|---|---|
| `src/tests/web/common/Button.spec.tsx` | variant/size/disabled/className マージの検証 |
| `src/tests/web/common/Select.spec.tsx` | render, className マージ, disabled の検証 |
| `src/tests/web/common/TextInput.spec.tsx` | render, type 属性, className マージの検証 |
| `src/tests/web/common/Textarea.spec.tsx` | render, className マージの検証 |
| `src/tests/web/common/Checkbox.spec.tsx` | render, label 表示, checked/onChange の検証 |
| `src/tests/web/common/RadioGroup.spec.tsx` | render, options 表示, value/onChange, disabled の検証 |

### 既存テストへの影響

外部インターフェース（props, コールバック）は変わらないため、既存テストへの影響は最小。DOM セレクタ（`.btn-run` 等）でテストしている箇所がある場合は更新が必要。

## `extract-collapsible-section` タスクとの関係

先行タスク `extract-collapsible-section` で `_option-group.scss` の共通 SCSS partial 抽出が計画されている。本タスクの `Select`・`TextInput` コンポーネント化により、`_option-group.scss` の select / input スタイルは不要となる。**本タスクを先に実施するか、`extract-collapsible-section` の `_option-group.scss` 計画を本タスクの成果物で置き換える** のが効率的。

## 作業順序

1. `Button` コンポーネント + SCSS 作成
2. `Select` コンポーネント + SCSS 作成
3. `TextInput` コンポーネント + SCSS 作成
4. `Textarea` コンポーネント + SCSS 作成
5. `Checkbox` コンポーネント + SCSS 作成
6. `RadioGroup` コンポーネント + SCSS 作成
7. 各コンポーネントのユニットテスト作成
8. execution 系コンポーネントのリファクタリング（ExecutionControls, CompileOptions, ExecutionOptions, InputPanel, OutputPanel, CompileOutputPanel）
9. test-editor 系コンポーネントのリファクタリング（TestCaseEditForm, TestCaseCreateForm, TestListPanel, CheckResultEditor, SuccessIOForm, SuccessTraceForm, CompileErrorForm, ParseErrorForm）
10. 不要になった SCSS のスタイル削除
11. ビルド・既存テスト通過確認
