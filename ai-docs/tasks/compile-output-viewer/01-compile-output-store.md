# コンパイル結果のデータモデル・atom 設計

## 実装状況（2026-02-27 完了）

| 項目 | 状態 | 備考 |
|------|------|------|
| `CompileOutput` 型 | ✅ 実装済み | `src/web/stores/compileOutputAtom.ts` |
| `compileOutputAtom` | ✅ 実装済み | `src/web/stores/compileOutputAtom.ts` |
| `whitespaceDisplayModeAtom` | ✅ 実装済み | `src/web/stores/compileOutputAtom.ts` |
| `compileOutputPageAtom` | ✅ 実装済み | `src/web/stores/compileOutputAtom.ts` |
| `compileOutputPageSizeAtom` | ✅ 実装済み | `src/web/stores/compileOutputAtom.ts` |

## 概要

コンパイル結果を実行出力（OutputPanel）とは分離して管理する。
専用の atom に格納し、表示モードやページネーションの状態も atom で管理する。

## 実装済みデータ型・atom

### `CompileOutput`（実装済み）

```typescript
// src/web/stores/compileOutputAtom.ts

import { atom } from 'jotai';
import type { CompileTarget } from '../../interfaces/NospaceTypes';

/** コンパイル結果（中間出力表示用） */
export interface CompileOutput {
  /** コンパイル結果テキスト */
  output: string;
  /** コンパイルに使用されたターゲット */
  target: CompileTarget;
}

/** コンパイル中間出力を保持する atom */
export const compileOutputAtom = atom<CompileOutput | null>(null);
```

## 残タスク（未実装 atom）

### `src/web/stores/compileOutputAtom.ts` への追加

以下の atom を `compileOutputAtom.ts` に追加する。

```typescript
/**
 * Whitespace 出力の表示モード。
 * - 'raw': そのまま表示（不可視文字のまま）
 * - 'visible': SP/TB/LF に置換して表示
 */
export type WhitespaceDisplayMode = 'raw' | 'visible';

/**
 * Whitespace 表示モード。
 * ws / ex-ws ターゲット出力時に通常表示と可視文字表示を切り替える。
 */
export const whitespaceDisplayModeAtom = atom<WhitespaceDisplayMode>('visible');

/**
 * ページネーション: 現在のページ番号（0-based）。
 */
export const compileOutputPageAtom = atom<number>(0);

/**
 * ページネーション: 1 ページあたりの行数。
 */
export const compileOutputPageSizeAtom = atom<number>(100);
```

### デフォルト値の設計意図

| atom | デフォルト | 理由 |
|------|----------|------|
| `whitespaceDisplayModeAtom` | `'visible'` | ws ターゲット出力はそのままでは視認不能なため、初回から可視モードにする |
| `compileOutputPageAtom` | `0` | 先頭ページ |
| `compileOutputPageSizeAtom` | `100` | 画面表示とパフォーマンスのバランス |

## データフロー図（現状）

```
                     Compile ボタン押下
                           │
                           ▼
                  handleCompile()
                  └── backend.compile(code, options)
                           │
                           ▼
              WasmExecutionBackend.compile()
                      │           │
                  success       error
                      │           │
                      ▼           ▼
           compileOutputAtom 更新  outputCallback (stderr)
                      │
                      ▼
            CompileOutputPanel 再描画（textarea）
```
