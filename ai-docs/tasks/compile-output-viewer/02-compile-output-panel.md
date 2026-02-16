# CompileOutputPanel コンポーネント設計

## 概要

コンパイル結果を専用パネルで表示するコンポーネント。
Whitespace 出力の可視文字切り替えとページネーションを備える。

## コンポーネント構成

```
CompileOutputPanel
├── ヘッダー
│   ├── タイトル ("Compile Output")
│   ├── DisplayModeToggle    ← ws/ex-ws ターゲット時のみ表示
│   └── Clear ボタン
├── コンテンツ
│   └── コンパイル結果テキスト（ページ分割済み）
└── フッター
    └── Pagination           ← 2ページ以上ある場合のみ表示
```

## Whitespace 可視化ユーティリティ

### `src/web/libs/whitespaceFormatter.ts`（新規）

```typescript
/**
 * Whitespace の不可視文字を可視トークンに変換する。
 *
 * 変換ルール:
 *   スペース (U+0020) → "SP"
 *   タブ (U+0009)     → "TB"
 *   改行 (U+000A)     → "LF\n"
 *
 * 改行は "LF" トークンの後に実際の改行文字も付加し、
 * 行構造を維持する。
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
        // ws ターゲット出力にはSP/TB/LF以外の文字は原則含まれないが、
        // ex-ws 等で他の文字が含まれる場合はそのまま出力する
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

### 設計上の考慮

#### トークン区切り

Whitespace の各文字を `SP` `TB` `LF` の 2 文字トークンで表現する。
1 文字略語 (`S`, `T`, `L`) は他のターゲット出力との区別がつきにくいため、
2 文字表記を採用する。

#### 行の維持

`LF` トークンの後に実際の改行 (`\n`) を付加することで、
通常表示と可視表示で行数とレイアウトを一致させる。

```
# 入力 (ws ターゲット出力):
"  \t\n \t \n"

# 可視表示:
"SPSPTBLF\nSPTBSPLF\n"

# 表示結果 (改行で折り返し):
SPSPTBLF
SPTBSPLF
```

## CompileOutputPanel コンポーネント

### `src/web/components/execution/CompileOutputPanel.tsx`（新規）

```tsx
import React, { useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  compileResultAtom,
  whitespaceDisplayModeAtom,
  compileOutputPageAtom,
  compileOutputPageSizeAtom,
} from '../../stores/compileResultAtom';
import { formatWhitespaceVisible, isWhitespaceTarget } from '../../libs/whitespaceFormatter';
import './styles/CompileOutputPanel.scss';

export const CompileOutputPanel: React.FC = () => {
  const compileResult = useAtomValue(compileResultAtom);
  const [displayMode, setDisplayMode] = useAtom(whitespaceDisplayModeAtom);
  const [currentPage, setCurrentPage] = useAtom(compileOutputPageAtom);
  const pageSize = useAtomValue(compileOutputPageSizeAtom);

  // コンパイル結果がなければ非表示
  if (!compileResult) return null;

  const showDisplayToggle = isWhitespaceTarget(compileResult.target);

  // 表示テキストを生成
  const displayText = useMemo(() => {
    if (showDisplayToggle && displayMode === 'visible') {
      return formatWhitespaceVisible(compileResult.output);
    }
    return compileResult.output;
  }, [compileResult.output, displayMode, showDisplayToggle]);

  // 行分割・ページネーション
  const lines = useMemo(() => displayText.split('\n'), [displayText]);
  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const showPagination = totalPages > 1;

  // 現在ページの行を抽出
  const pageLines = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return lines.slice(start, end);
  }, [lines, currentPage, pageSize]);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(0, p - 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  const handleFirstPage = () => setCurrentPage(0);
  const handleLastPage = () => setCurrentPage(totalPages - 1);

  return (
    <div className="compile-output-panel">
      <div className="compile-output-header">
        <h3>Compile Output</h3>

        <div className="compile-output-actions">
          {/* Whitespace 表示モード切り替え */}
          {showDisplayToggle && (
            <div className="display-mode-toggle">
              <button
                className={`btn-mode ${displayMode === 'raw' ? 'active' : ''}`}
                onClick={() => setDisplayMode('raw')}
                title="通常表示（そのまま）"
              >
                Raw
              </button>
              <button
                className={`btn-mode ${displayMode === 'visible' ? 'active' : ''}`}
                onClick={() => setDisplayMode('visible')}
                title="可視文字表示（SP/TB/LF）"
              >
                SP TB LF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* コンパイル結果テキスト */}
      <div className="compile-output-content">
        <pre>{pageLines.join('\n')}</pre>
      </div>

      {/* ページネーション */}
      {showPagination && (
        <div className="compile-output-pagination">
          <button onClick={handleFirstPage} disabled={currentPage === 0}>
            &#x226A;
          </button>
          <button onClick={handlePrevPage} disabled={currentPage === 0}>
            &lt;
          </button>
          <span className="page-info">
            {currentPage + 1} / {totalPages}
            <span className="line-info">
              ({lines.length} lines)
            </span>
          </span>
          <button onClick={handleNextPage} disabled={currentPage >= totalPages - 1}>
            &gt;
          </button>
          <button onClick={handleLastPage} disabled={currentPage >= totalPages - 1}>
            &#x226B;
          </button>
        </div>
      )}
    </div>
  );
};
```

### ページネーション動作仕様

| 操作 | 動作 |
|------|------|
| `≪` | 先頭ページへ移動 |
| `<` | 前のページへ移動 |
| `>` | 次のページへ移動 |
| `≫` | 末尾ページへ移動 |

- 現在のページ位置を `1 / N` 形式で表示
- 全行数を `(123 lines)` 形式で表示
- 端のページにいる場合、該当ボタンを disabled に

### ページリセットのタイミング

| イベント | ページ番号 |
|---------|-----------|
| 新規コンパイル実行 | 0 にリセット |
| 表示モード切り替え | 0 にリセット（行数が変わるため） |
| ページサイズ変更 | 0 にリセット |

## スタイル

### `src/web/components/execution/styles/CompileOutputPanel.scss`（新規）

```scss
.compile-output-panel {
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  margin-top: 8px;
  max-height: 400px;
}

.compile-output-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 0.85rem;
    color: #cccccc;
  }
}

.compile-output-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.display-mode-toggle {
  display: flex;
  border: 1px solid #555;
  border-radius: 3px;
  overflow: hidden;

  .btn-mode {
    padding: 2px 8px;
    font-size: 0.75rem;
    background: transparent;
    color: #aaa;
    border: none;
    cursor: pointer;

    &.active {
      background: #0e639c;
      color: #fff;
    }

    &:hover:not(.active) {
      background: #333;
    }

    & + .btn-mode {
      border-left: 1px solid #555;
    }
  }
}

.compile-output-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
  min-height: 100px;

  pre {
    margin: 0;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 0.85rem;
    line-height: 1.4;
    color: #d4d4d4;
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.compile-output-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border-top: 1px solid #3c3c3c;
  flex-shrink: 0;

  button {
    padding: 2px 8px;
    font-size: 0.8rem;
    background: #333;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 3px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: #444;
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .page-info {
    font-size: 0.8rem;
    color: #aaa;
    padding: 0 8px;

    .line-info {
      margin-left: 8px;
      color: #666;
      font-size: 0.75rem;
    }
  }
}
```

## ExecutionContainer への配置

```tsx
// src/web/containers/ExecutionContainer.tsx

import { CompileOutputPanel } from '../components/execution/CompileOutputPanel';

export const ExecutionContainer: React.FC = () => {
  // ...

  return (
    <div className="execution-container">
      <ExecutionOptions />
      {/* CompileOptions（Phase 11 で追加） */}
      <ExecutionControls ... />
      <CompileOutputPanel />
      <OutputPanel onClear={handleClearOutput} />
      <InputPanel ... />
    </div>
  );
};
```

`CompileOutputPanel` は `compileResultAtom` が `null` の場合は何も描画しないため、
コンパイル未実行時には見た目に影響しない。

## テスト方針

### whitespaceFormatter のユニットテスト

- `formatWhitespaceVisible`: 各文字の変換、混合文字列、空文字列
- `isWhitespaceTarget`: `ws`, `ex-ws` で true、`mnemonic`, `json` で false

### CompileOutputPanel のコンポーネントテスト

- `compileResultAtom` が `null` → 非表示
- `ws` ターゲット → 表示モードトグル表示
- `mnemonic` ターゲット → 表示モードトグル非表示
- ページネーション: 100 行超の出力でページ送りが動作
- ページネーション: 100 行以下でページ送り非表示

### テストファイル

```
src/tests/web/
├── whitespaceFormatter.spec.ts          # ユーティリティテスト
└── CompileOutputPanel.spec.tsx          # コンポーネントテスト
```
