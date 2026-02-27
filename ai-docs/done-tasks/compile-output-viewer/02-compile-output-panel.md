# CompileOutputPanel コンポーネント設計

## 実装状況（2026-02-27 完了）

| 機能 | 状態 | 備考 |
|------|------|------|
| 基本パネル表示（CollapsibleSection + textarea） | ✅ 実装済み | `src/web/components/execution/CompileOutputPanel.tsx` |
| Run ボタン（ws ターゲット時） | ✅ 実装済み | コンパイル済み Whitespace を直接実行 |
| Whitespace 可視化（SP/TB/LF 表示） | ✅ 実装済み | `src/web/libs/whitespaceFormatter.ts` |
| 表示モード切り替え UI | ✅ 実装済み | ws/ex-ws ターゲット時のみ表示 |
| ページネーション | ✅ 実装済み | 101 行以上で自動表示 |

## 現在の実装

### `src/web/components/execution/CompileOutputPanel.tsx`（実装済み）

- `compileOutput` props で `CompileOutput | null` を受け取る
- `CollapsibleSection` でラップ、折りたたみ対応
- `ws` ターゲット時のみ Run ボタンを表示（`onRunCompiled` props）
- コンパイル出力を `<textarea readOnly>` で表示

#### Props

```typescript
interface CompileOutputPanelProps {
  compileOutput: CompileOutput | null;
  onRunCompiled?: () => void;      // ws ターゲット時に Run ボタンから呼び出される
  isRunning: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

## 残タスク

### 1. Whitespace 可視化ユーティリティの作成

`src/web/libs/whitespaceFormatter.ts` を新規作成する。

```typescript
/**
 * Whitespace の不可視文字を可視トークンに変換する。
 *
 * 変換ルール:
 *   スペース (U+0020) → "SP"
 *   タブ (U+0009)     → "TB"
 *   改行 (U+000A)     → "LF\n"
 */
export function formatWhitespaceVisible(input: string): string {
  let result = '';
  for (const ch of input) {
    switch (ch) {
      case ' ':
        result += 'SP';
        break;
      case '\t':
        result += 'TB';
        break;
      case '\n':
        result += 'LF\n';
        break;
      default:
        result += ch;
        break;
    }
  }
  return result;
}

/**
 * 対象のコンパイルターゲットが Whitespace 可視化対象かどうかを判定する。
 */
export function isWhitespaceTarget(target: string): boolean {
  return target === 'ws' || target === 'ex-ws';
}
```

#### 変換例

```
# 入力 (ws ターゲット出力):
"  \t\n \t \n"

# 可視表示:
"SPSPTBLF\nSPTBSPLF\n"

# 表示結果（改行で折り返し）:
SPSPTBLF
SPTBSPLF
```

### 2. atom 追加（`src/web/stores/compileOutputAtom.ts`）

`01-compile-output-store.md` 参照。

- `WhitespaceDisplayMode` 型
- `whitespaceDisplayModeAtom`（デフォルト `'visible'`）
- `compileOutputPageAtom`（デフォルト `0`）
- `compileOutputPageSizeAtom`（デフォルト `100`）

### 3. `CompileOutputPanel` への機能追加

既存の `textarea` 表示を拡張して以下を追加する。

#### 表示モード切り替え（ws/ex-ws ターゲット時のみ）

- コンパイル出力ヘッダーに Raw / SP TB LF の切り替えボタンを追加
- `whitespaceDisplayModeAtom` と連動

#### ページネーション

- 表示テキストを行単位で分割し、`compileOutputPageSizeAtom` 行ごとにページ分割
- ページ数が 2 以上の場合のみページネーション UI を表示
- `«` `<` `>` `»` ボタンで先頭/前/次/末尾ページへ移動
- 現在ページを `1 / N (123 lines)` 形式で表示

#### ページリセット

| イベント | ページ番号 |
|---------|-----------|
| 新規コンパイル実行 | 0 にリセット |
| 表示モード切り替え | 0 にリセット（行数が変わるため） |

## テスト方針

### whitespaceFormatter のユニットテスト

- `formatWhitespaceVisible`: 各文字の変換、混合文字列、空文字列
- `isWhitespaceTarget`: `ws`, `ex-ws` で true、`mnemonic`, `json` で false

### CompileOutputPanel のコンポーネントテスト（既存テストの拡張）

既存: `src/tests/web/CompileOutputPanel.spec.tsx`

追加項目:
- `ws` ターゲット + 可視モード → SP/TB/LF テキストを表示
- `ws` ターゲット → 表示モードトグル表示
- `mnemonic` ターゲット → 表示モードトグル非表示
- ページネーション: 100 行超の出力でページ送りが動作
- ページネーション: 100 行以下でページ送り非表示
