# コンパイル結果のデータモデル・atom 設計

## 概要

コンパイル結果を実行出力（OutputPanel）とは分離して管理する。
専用の atom に格納し、表示モードやページネーションの状態も atom で管理する。

## データ型

### `CompileResultData`（新規）

```typescript
// src/interfaces/NospaceTypes.ts に追加

/**
 * コンパイル結果データ。
 * コンパイル成功時の出力テキストとメタ情報を保持する。
 */
export interface CompileResultData {
  /** コンパイル出力テキスト（全文） */
  output: string;
  /** コンパイルに使用したターゲット */
  target: CompileTarget;
  /** コンパイルに使用した言語サブセット */
  language: LanguageSubset;
  /** コンパイル完了時刻 */
  timestamp: number;
}
```

### Whitespace 表示モード

```typescript
// src/interfaces/NospaceTypes.ts に追加

/**
 * Whitespace 出力の表示モード。
 * - 'raw': そのまま表示（不可視文字のまま）
 * - 'visible': SP/TB/LF に置換して表示
 */
export type WhitespaceDisplayMode = 'raw' | 'visible';
```

## Jotai Atoms

### `src/web/stores/compileResultAtom.ts`（新規）

```typescript
import { atom } from 'jotai';
import type { CompileResultData, WhitespaceDisplayMode } from '../../interfaces/NospaceTypes';

/**
 * コンパイル結果。成功時にセットされる。
 * null はコンパイル未実行または結果クリア済みを示す。
 */
export const compileResultAtom = atom<CompileResultData | null>(null);

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
| `compileResultAtom` | `null` | コンパイル未実行状態 |
| `whitespaceDisplayModeAtom` | `'visible'` | ws ターゲット出力はそのままでは視認不能なため、初回から可視モードにする |
| `compileOutputPageAtom` | `0` | 先頭ページ |
| `compileOutputPageSizeAtom` | `100` | 画面表示とパフォーマンスのバランス |

## ExecutionBackend インターフェース変更

### `onCompileOutput` コールバック追加

```typescript
// src/web/services/ExecutionBackend.ts に追加

export interface ExecutionBackend {
  // ... 既存メソッド ...

  /**
   * コンパイル結果を受け取るコールバックを登録する。
   * compile() 成功時に呼び出される。
   */
  onCompileOutput(callback: (result: CompileResultData) => void): void;
}
```

### WasmExecutionBackend の変更

```typescript
// src/web/services/WasmExecutionBackend.ts

export class WasmExecutionBackend implements ExecutionBackend {
  // ... 既存フィールド ...
  private compileOutputCallback: ((result: CompileResultData) => void) | null = null;

  compile(code: string, options: CompileOptions): void {
    const sessionId = crypto.randomUUID();

    (async () => {
      const nospace20 = getNospace20();

      try {
        this.statusCallback?.('compiling', sessionId);
        const result = nospace20.compile(code, options.target, options.language);

        if (result.success) {
          // 既存: stdout 出力（互換性維持のため残す）
          this.outputCallback?.({
            type: 'stdout',
            data: result.output + '\n',
            timestamp: Date.now(),
          });

          // 新規: コンパイル結果を専用コールバックで通知
          this.compileOutputCallback?.({
            output: result.output,
            target: options.target,
            language: options.language,
            timestamp: Date.now(),
          });

          this.statusCallback?.('finished', sessionId, 0);
        } else {
          // エラー処理は既存のまま
          const errorMessages = formatErrorEntries(result.errors);
          this.outputCallback?.({
            type: 'stderr',
            data: errorMessages + '\n',
            timestamp: Date.now(),
          });
          this.statusCallback?.('error', sessionId);
        }
      } catch (e) {
        // ... 既存の例外処理 ...
      }
    })();
  }

  onCompileOutput(callback: (result: CompileResultData) => void): void {
    this.compileOutputCallback = callback;
  }
}
```

### ServerExecutionBackend の変更

Server flavor は compile 未サポートのため、`onCompileOutput` は no-op。

```typescript
onCompileOutput(_callback: (result: CompileResultData) => void): void {
  // Server flavor does not support compile
}
```

## useNospaceExecution フック変更

```typescript
// src/web/hooks/useNospaceExecution.ts

import { compileResultAtom, compileOutputPageAtom } from '../stores/compileResultAtom';

export function useNospaceExecution(...) {
  // ... 既存 ...
  const setCompileResult = useSetAtom(compileResultAtom);
  const setCompileOutputPage = useSetAtom(compileOutputPageAtom);

  // バックエンド初期化時に compileOutput コールバックを登録
  useEffect(() => {
    // ... 既存の backend 初期化 ...
    backend.onCompileOutput((result) => {
      setCompileResult(result);
      setCompileOutputPage(0); // コンパイル時にページを先頭にリセット
    });
    // ...
  }, [/* ... */]);

  const handleCompile = useCallback(() => {
    const backend = backendRef.current;
    if (!backend || !backend.isReady() || isRunning) return;
    setOutputEntries([]);
    setCompileResult(null); // 前回の結果をクリア
    backend.compile(sourceCode, compileOptions);
  }, [sourceCode, compileOptions, isRunning, setOutputEntries, setCompileResult]);

  return {
    // ... 既存 ...
    handleCompile,
  };
}
```

## データフロー図

```
                     Compile ボタン押下
                           │
                           ▼
                  handleCompile()
                  ├── setOutputEntries([])
                  ├── setCompileResult(null)
                  └── backend.compile(code, options)
                           │
                           ▼
              WasmExecutionBackend.compile()
                      │           │
                  success       error
                      │           │
                      ▼           ▼
        compileOutputCallback  outputCallback (stderr)
                      │
                      ▼
           setCompileResult({
             output, target,
             language, timestamp
           })
                      │
                      ▼
            compileResultAtom 更新
                      │
                      ▼
            CompileOutputPanel 再描画
            ├── whitespaceDisplayModeAtom → 表示モード
            ├── compileOutputPageAtom → ページ番号
            └── compileOutputPageSizeAtom → ページサイズ
```
