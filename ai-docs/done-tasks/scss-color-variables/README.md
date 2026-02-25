# SCSS カラー変数の一元管理

## 完了状態

2026-02-26 実装完了。`npm run build` にて正常ビルドを確認。

全 SCSS ファイルでカラーコードが直接指定されている。これを SCSS 変数として一か所に定義し、各ファイルからは変数名で参照する形に統一する。

## 現状の問題

- 20 個の SCSS ファイルに 185 箇所以上のハードコードされたカラーコードが存在
- 同一カラーコードが複数ファイルに重複（例: `#d4d4d4` は 15 箇所以上）
- カラー変更時に全ファイルを個別修正する必要がある
- CSS custom property `--accent-color` が 3 箇所だけ部分的に使用されている

## 方針

### SCSS 変数を使用する理由

- コンパイル時に解決されるため実行時オーバーヘッドなし
- プロジェクトが既に SCSS ベース
- `@use` による明示的なインポートでスコープ管理が可能

### 新規ファイル

`src/web/styles/_colors.scss` を新規作成し、全カラー変数を定義する。

### インポート方法

各 SCSS ファイルの先頭で `@use` を使用してインポートする。
パスは各ファイルからの相対パス。名前空間は `colors` とする。

```scss
@use '../../styles/colors';

.example {
  color: colors.$text-primary;
}
```

## default.scss のデッドコード

`default.scss` は `viteroot.tsx` から読み込まれるグローバルスタイルだが、以下のデッドコードを含む:

- `body { background-color: #f5f5f5; color: #333; }` — `index.scss` の `.app { background-color: #1e1e1e; }` で上書きされ不使用
- `.app-header` — どのコンポーネントからも参照されていない
- `.app-footer` — どのコンポーネントからも参照されていない

**対応**: `body` の背景色・テキスト色をダークテーマに統一（`$bg-primary` / `$text-primary`）。`.app-header` / `.app-footer` のスタイルは削除する。

## カラー変数定義

旧設計（35 変数）から統合を行い **25 変数** に削減した。

統合の方針:
- 同一値の変数を統合（`$divider` = `$border-primary`、`$divider-hover` = `$text-dimmed`）
- `rgba()` はインラインで `$accent-primary` から算出し、専用変数を設けない
- `.app-header` / `.app-footer` のデッドコード用カラー（5 変数）を削除

### 背景色（Background）

| 変数名 | 値 | 用途 |
|---|---|---|
| `$bg-primary` | `#1e1e1e` | メイン背景（エディタ、body、アプリ全体） |
| `$bg-secondary` | `#252526` | サイドバー・パネルの背景 |
| `$bg-tertiary` | `#2d2d2d` | ヘッダー・セクション背景 |
| `$bg-hover` | `#2a2d2e` | リストアイテムホバー |
| `$bg-input` | `#3c3c3c` | 入力フィールド・コントロール背景 |
| `$bg-input-hover` | `#4a4a4a` | 入力フィールドホバー |
| `$bg-button-secondary` | `#5a5a5a` | セカンダリボタン |
| `$bg-button-secondary-hover` | `#6a6a6a` | セカンダリボタンホバー |

### 枠線色（Border）

| 変数名 | 値 | 用途 |
|---|---|---|
| `$border-primary` | `#444` | パネル・セクション境界、分割ペイン区切り線 |
| `$border-secondary` | `#555` | 入力フィールド枠線 |

### 文字色（Text）

| 変数名 | 値 | 用途 |
|---|---|---|
| `$text-primary` | `#d4d4d4` | 主要テキスト |
| `$text-secondary` | `#ccc` | ラベルテキスト |
| `$text-muted` | `#888` | プレースホルダー・無効テキスト |
| `$text-dimmed` | `#666` | 薄いテキスト、分割ペインホバー |
| `$text-bright` | `#e0e0e0` | 明るいテキスト（選択アイテム、ラベル） |
| `$text-white` | `#fff` | 白テキスト（`#ffffff` 含む） |

### アクセントカラー（Accent）

| 変数名 | 値 | 用途 |
|---|---|---|
| `$accent-primary` | `#007acc` | メインアクセント（フォーカス、アクティブタブ、選択） |
| `$accent-blue-dark` | `#0d5aa7` | コンパイルボタン背景 |
| `$accent-blue-hover` | `#1177d2` | ボタンホバー（青） |
| `$accent-blue-selected` | `#094771` | 選択アイテム背景（暗い青） |

### セマンティックカラー（Semantic）

| 変数名 | 値 | 用途 |
|---|---|---|
| `$success` | `#0e7a0d` | 成功・実行ボタン（緑） |
| `$success-hover` | `#0f9d0c` | 成功ボタンホバー |
| `$danger` | `#a1260d` | 危険・停止ボタン（赤） |
| `$danger-hover` | `#c72e0d` | 危険ボタンホバー |
| `$error-text` | `#f48771` | エラーテキスト |
| `$error-bg` | `#5a2020` | エラー背景 |
| `$info-text` | `#4ec9b0` | 情報テキスト（ティール） |

### 削除した変数（旧設計からの差分）

| 旧変数名 | 旧値 | 理由 |
|---|---|---|
| `$light-bg` | `#f5f5f5` | デッドコード。`body` は `$bg-primary` に変更 |
| `$light-text` | `#333` | デッドコード。`body` は `$text-primary` に変更 |
| `$light-header-bg` | `#2c3e50` | デッドコード（`.app-header` 未使用）。スタイルごと削除 |
| `$light-footer-bg` | `#ecf0f1` | デッドコード（`.app-footer` 未使用）。スタイルごと削除 |
| `$light-footer-text` | `#7f8c8d` | デッドコード（`.app-footer` 未使用）。スタイルごと削除 |
| `$divider` | `#444` | `$border-primary` と同値。統合 |
| `$divider-hover` | `#666` | `$text-dimmed` と同値。統合 |
| `$accent-primary-alpha` | `rgba(0,122,204,0.1)` | インラインで `rgba($accent-primary, 0.1)` と記述 |

### インラインで算出する値

| 記述方法 | 用途 |
|---|---|
| `rgba(colors.$accent-primary, 0.1)` | フォーカスシャドウ（CompileOptions.scss） |

## 対象ファイルと変更内容

### 新規作成

| ファイル | 内容 |
|---|---|
| `src/web/styles/_colors.scss` | 全カラー変数定義 |

### 変更対象ファイル一覧

各ファイルに対して行う作業:
1. ファイル先頭に `@use` によるインポート追加
2. ハードコードされたカラーコードを変数参照に置換
3. `var(--accent-color, #007acc)` を `colors.$accent-primary` に置換

| ファイル | カラーコード数（概算） |
|---|---|
| `src/web/pages/styles/index.scss` | 1 |
| `src/web/containers/styles/EditorContainer.scss` | 1 |
| `src/web/containers/styles/ExecutionContainer.scss` | 7 |
| `src/web/containers/styles/TestEditorContainer.scss` | 3 |
| `src/web/components/styles/default.scss` | 5（うちデッドコード削除 3、ダークテーマ化 2） |
| `src/web/components/layout/styles/Header.scss` | 8 |
| `src/web/components/layout/styles/SplitPane.scss` | 2 |
| `src/web/components/editor/styles/CodeTextarea.scss` | 3 |
| `src/web/components/editor/styles/NospaceEditor.scss` | 0（カラー未使用） |
| `src/web/components/execution/styles/ExecutionControls.scss` | 4 |
| `src/web/components/execution/styles/ExecutionOptions.scss` | 12 |
| `src/web/components/execution/styles/CompileOptions.scss` | 10 |
| `src/web/components/execution/styles/OutputPanel.scss` | 12 |
| `src/web/components/execution/styles/CompileOutputPanel.scss` | 8 |
| `src/web/components/execution/styles/InputPanel.scss` | 10 |
| `src/web/components/test-editor/styles/CheckResultEditor.scss` | 53 |
| `src/web/components/test-editor/styles/TestListPanel.scss` | 13 |
| `src/web/components/test-editor/styles/TestEditorPanel.scss` | 2 |
| `src/web/components/test-editor/styles/TestCaseEditForm.scss` | 18 |
| `src/web/components/test-editor/styles/TestCaseCreateForm.scss` | 0（@use のみ） |

### 注意事項

- `TestCaseCreateForm.scss` は既に `@use './TestCaseEditForm.scss';` を使用している。`_colors.scss` の追加インポートは不要（カラーコード未定義）。
- `SplitPane.scss` の `#444` と `#666` は区切り線用途で、`$border-primary` / `$text-dimmed` と同値。同じ変数を使用する。
- `NospaceEditor.scss` はカラーコード未使用のため変更不要。
- `default.scss` の `.app-header` / `.app-footer` はデッドコードのため、スタイルブロックごと削除する。`body` の背景色（`#f5f5f5` → `$bg-primary`）・テキスト色（`#333` → `$text-primary`）はダークテーマに統一する。
- `CompileOptions.scss` の `rgba(0, 122, 204, 0.1)` は `rgba(colors.$accent-primary, 0.1)` に置換する（SCSS の組み込み関数で展開される）。
- 既存の `var(--accent-color, #007acc)` は `colors.$accent-primary` に統一し、CSS custom property は廃止する。

## 実装手順

1. `src/web/styles/_colors.scss` を作成し、全カラー変数を定義
2. 各 SCSS ファイルに `@use` を追加し、カラーコードを変数に置換
   - ファイル数が多いため、ディレクトリ単位で順に作業する:
     1. `pages/styles/`・`containers/styles/` (4 ファイル)
     2. `components/styles/`・`components/layout/styles/` (3 ファイル)
     3. `components/editor/styles/` (1 ファイル)
     4. `components/execution/styles/` (5 ファイル)
     5. `components/test-editor/styles/` (5 ファイル)
3. ビルド確認（`npm run build`）
4. 目視確認（開発サーバーで UI を確認）

## テスト・検証

- `npm run build` が成功すること
- 既存のスタイルテスト（存在すれば）が通ること
- ブラウザでの見た目に変化がないこと（カラー値は同一のため、変化なしが正しい）
