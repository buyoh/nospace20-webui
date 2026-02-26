# 折りたたみセクション・オプションパネルの共通コンポーネント化

## 概要

`CompileOptions`・`ExecutionOptions`・`CompileOutputPanel` の 3 コンポーネントが同一の折りたたみ UI パターンを個別に実装している。これを共通コンポーネント `CollapsibleSection` として切り出し、重複を排除する。また SCSS についても共通スタイルを抽出する。

## 現状の問題

### 1. 折りたたみ UI（TSX）の重複

3 コンポーネントが以下のほぼ同一の実装を持つ:

- `useState(false)` による collapsed 状態管理
- `<button>` ヘッダー + `▶`/`▼` アイコン + `<h3>` タイトル
- `aria-expanded` 属性
- `{!collapsed && <div>…</div>}` による条件付きボディ表示

| コンポーネント | collapsed 管理 | ヘッダー CSS クラス | 備考 |
|---|---|---|---|
| `CompileOptions` | 内部 state | `.options-header` | — |
| `ExecutionOptions` | 内部 state | `.options-header` | CompileOptions と同一構造 |
| `CompileOutputPanel` | props で外部制御 | `.collapse-toggle` | ヘッダー右側にアクションボタンあり |

### 2. SCSS スタイルの重複

`CompileOptions.scss` と `ExecutionOptions.scss` は以下のセレクタがほぼ同一:

- `.options-header` （flex レイアウト、背景色、ボーダー、hover）
- `.collapse-icon` （フォントサイズ、幅、テキスト中央揃え）
- `h3` （マージン、フォントサイズ）
- `&.collapsed .options-header` （ボーダー除去）
- `&.collapsed .options-body` （`display: none`）
- `.options-body` （パディング）
- `.option-group` ラベルの flex レイアウト

`CompileOutputPanel.scss` も `.collapse-toggle` + `.collapse-icon` + `h3` で類似のスタイルを持つ。

### 3. option-group のスタイル重複

`CompileOptions.scss` と `ExecutionOptions.scss` の `.option-group` 内の `label`、`select`、`input[type='number']` のスタイルが重複。

## 設計

### A. `CollapsibleSection` コンポーネント

新規ファイル: `src/web/components/common/CollapsibleSection.tsx`

```tsx
interface CollapsibleSectionProps {
  /** セクションタイトル */
  title: string;
  /** ルート要素に付与する追加クラス */
  className?: string;
  /** 初期折りたたみ状態（非制御モード向け。デフォルト: false） */
  defaultCollapsed?: boolean;
  /** 折りたたみ状態（制御モード）。指定時は defaultCollapsed は無視 */
  collapsed?: boolean;
  /** 折りたたみトグル時コールバック（制御モード） */
  onToggleCollapse?: () => void;
  /** ヘッダー右側に表示するアクション要素（ボタン等） */
  headerActions?: React.ReactNode;
  /** セクション本体 */
  children: React.ReactNode;
}
```

- **非制御モード**: `collapsed`/`onToggleCollapse` を省略すると内部 `useState` で状態管理。`CompileOptions`・`ExecutionOptions` で使用。
- **制御モード**: `collapsed`/`onToggleCollapse` を指定すると外部で状態管理。`CompileOutputPanel` で使用。
- `headerActions` で右側ボタン（Run 等）をスロットとして受け取る。

レンダリング構造:

```tsx
<div className={`collapsible-section ${className ?? ''} ${isCollapsed ? 'collapsed' : ''}`}>
  <div className="collapsible-header">
    <button
      className="collapsible-toggle"
      onClick={toggle}
      aria-expanded={!isCollapsed}
    >
      <span className="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
      <h3>{title}</h3>
    </button>
    {headerActions && (
      <div className="collapsible-actions">{headerActions}</div>
    )}
  </div>
  {!isCollapsed && (
    <div className="collapsible-body">{children}</div>
  )}
</div>
```

### B. 共通 SCSS

新規ファイル: `src/web/components/common/styles/CollapsibleSection.scss`

`CompileOptions.scss` と `ExecutionOptions.scss` の共通部分（`.options-header`、`.collapse-icon`、`h3`、`.options-body`、collapsed 状態のスタイル）を `.collapsible-section` クラス配下に統合。

### C. option-group SCSS の共通化

新規ファイル: `src/web/components/execution/styles/_option-group.scss`

`CompileOptions.scss` と `ExecutionOptions.scss` から `.option-group` のスタイルを抽出。各ファイルから `@use` で読み込む。

### D. 各コンポーネントのリファクタリング

#### CompileOptions

変更前:
```tsx
const [collapsed, setCollapsed] = useState(false);
return (
  <div className={`compile-options${collapsed ? ' collapsed' : ''}`}>
    <button className="options-header" ...>
      <span className="collapse-icon">...</span>
      <h3>Compile Options</h3>
    </button>
    {!collapsed && <div className="options-body">...内容...</div>}
  </div>
);
```

変更後:
```tsx
return (
  <CollapsibleSection title="Compile Options" className="compile-options">
    <div className="options-body">...内容...</div>
  </CollapsibleSection>
);
```

`CompileOptions.scss` からヘッダー・折りたたみ関連のスタイルを削除し、`option-group` は共通 partial から読み込み。

#### ExecutionOptions

同様に `CollapsibleSection` でラップ。

#### CompileOutputPanel

変更前:
```tsx
<div className={`compile-output-panel ${collapsed ? 'collapsed' : ''}`}>
  <div className="compile-output-header">
    <button className="collapse-toggle" onClick={onToggleCollapse} ...>
      <span className="collapse-icon">...</span>
      <h3>Compiled Output</h3>
    </button>
    <div className="compile-output-actions">...</div>
  </div>
  {!collapsed && <div className="compile-output-content">...</div>}
</div>
```

変更後:
```tsx
<CollapsibleSection
  title="Compiled Output"
  className="compile-output-panel"
  collapsed={collapsed}
  onToggleCollapse={onToggleCollapse}
  headerActions={canRun && <button ...>Run</button>}
>
  <div className="compile-output-content">...</div>
</CollapsibleSection>
```

`CompileOutputPanel.scss` から `.collapse-toggle`・`.collapse-icon`・`h3` のスタイルを削除。

## ファイル変更一覧

### 新規作成

| ファイル | 説明 |
|---|---|
| `src/web/components/common/CollapsibleSection.tsx` | 汎用折りたたみセクションコンポーネント |
| `src/web/components/common/styles/CollapsibleSection.scss` | 折りたたみセクション共通スタイル |
| `src/web/components/execution/styles/_option-group.scss` | option-group 共通スタイル partial |
| `src/tests/web/CollapsibleSection.spec.tsx` | CollapsibleSection のユニットテスト |

### 修正

| ファイル | 変更内容 |
|---|---|
| `src/web/components/execution/CompileOptions.tsx` | `CollapsibleSection` を使用、collapsed ロジック削除 |
| `src/web/components/execution/ExecutionOptions.tsx` | `CollapsibleSection` を使用、collapsed ロジック削除 |
| `src/web/components/execution/CompileOutputPanel.tsx` | `CollapsibleSection` を使用（制御モード）、collapse UI 削除 |
| `src/web/components/execution/styles/CompileOptions.scss` | ヘッダー・折りたたみスタイル削除、`_option-group` を `@use` |
| `src/web/components/execution/styles/ExecutionOptions.scss` | ヘッダー・折りたたみスタイル削除、`_option-group` を `@use` |
| `src/web/components/execution/styles/CompileOutputPanel.scss` | `.collapse-toggle` 関連スタイル削除 |

## テスト方針

### CollapsibleSection ユニットテスト

- 非制御モード: クリックで折りたたみ/展開が切り替わること
- 制御モード: `collapsed` prop に従い表示/非表示になること
- `headerActions` が描画されること
- `aria-expanded` が正しく設定されること
- `className` が root 要素に付与されること

### 既存テストへの影響

`CompileOptions`・`ExecutionOptions`・`CompileOutputPanel` のテスト（hooks テストで間接的に使用）は、コンポーネントの外部インターフェースが変わらないため影響なし。折りたたみの DOM 構造が変わるため、もし個別のコンポーネントテストが存在しセレクタに依存している場合は更新が必要。

## 作業順序

1. `CollapsibleSection` コンポーネント + SCSS 作成
2. `_option-group.scss` 作成
3. `CompileOptions` リファクタリング + SCSS 更新
4. `ExecutionOptions` リファクタリング + SCSS 更新
5. `CompileOutputPanel` リファクタリング + SCSS 更新
6. `CollapsibleSection` テスト作成
7. ビルド・既存テスト通過確認


## 進捗

- 実装完了 (2025-07-25)
  - `CollapsibleSection` コンポーネント・スタイル作成
  - `CompileOptions`・`ExecutionOptions`・`CompileOutputPanel` をリファクタリング
  - テスト作成・全テスト通過確認
