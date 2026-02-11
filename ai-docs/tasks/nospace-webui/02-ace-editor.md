# Ace Editor 統合と nospace Syntax Highlighting

## 概要

Ace Editor を React コンポーネントとして統合し、nospace 言語の syntax highlighting を実現する。

## パッケージ

```
npm install ace-builds react-ace
```

- `ace-builds`: Ace Editor 本体（テーマ・モードを含む）
- `react-ace`: React ラッパーコンポーネント

## NospaceEditor コンポーネント

```typescript
// src/web/components/editor/NospaceEditor.tsx
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/theme-monokai';
import './nospace-ace-mode';  // カスタムモード

interface NospaceEditorProps {
  value: string;
  onChange: (value: string) => void;
}
```

### 設定

| 設定 | 値 |
|------|-----|
| テーマ | `monokai`（暗い背景の定番。他候補: `github`, `tomorrow`） |
| フォントサイズ | 14px |
| タブ幅 | 2 |
| 行番号表示 | あり |
| 自動補完 | なし（nospace は補完不要） |
| 折り返し | なし |
| 高さ | 親要素に合わせて 100% |

## Syntax Highlighting: tmLanguage → Ace Mode 変換

### 背景

nospace の syntax 定義は TextMate Grammar 形式（`nospace.tmLanguage.json`）で提供されている。
Ace Editor は独自の highlight ルール形式を使うため、変換が必要。

### 方針: 手動で Ace Mode を作成

tmLanguage から Ace の highlight rules への自動変換は複雑であり、完全な互換性は保証されない。
nospace の文法はシンプルなので、tmLanguage を参照しつつ手動で Ace Mode を作成する。

### tmLanguage のパターン分析

`nospace.tmLanguage.json` から抽出したルール:

| カテゴリ | パターン | Ace トークン |
|---------|---------|-------------|
| コメント | `#...#` | `comment.block` |
| キーワード (制御) | `if`, `else`, `while`, `return`, `break`, `continue` | `keyword.control` |
| キーワード (宣言) | `func`, `let` | `keyword.declaration` → `keyword` |
| ビルトイン (デバッグ) | `__clog`, `__assert`, `__assert_not`, `__trace` | `support.function` |
| ビルトイン (IO) | `__puti`, `__putc`, `__geti`, `__getc` | `support.function` |
| 文字列 | `'...'`（エスケープ: `\\`, `\t`, `\n`, `\s`, `\'`, `\r`） | `string` |
| 数値 | `[0-9]+` | `constant.numeric` |
| 演算子 (比較) | `==`, `!=`, `<=`, `>=`, `<`, `>` | `keyword.operator` |
| 演算子 (論理) | `&&`, `\|\|`, `!` | `keyword.operator` |
| 演算子 (算術) | `+`, `-`, `*`, `/`, `%` | `keyword.operator` |
| 演算子 (代入) | `=` | `keyword.operator` |
| 区切り | `:`, `,`, `;`, `{`, `}`, `(`, `)` | `paren` / `punctuation` |
| 関数定義 | `func:name(` | `keyword` + `entity.name.function` |
| 関数呼び出し | `name(` | `entity.name.function` → `identifier` |
| 変数 | `[a-zA-Z_][a-zA-Z0-9_]*` | `identifier` |

### Ace Mode 実装ファイル

```
src/web/components/editor/nospace-ace-mode.ts
```

Ace のカスタムモードは `ace.define` を使って定義する:

```typescript
import ace from 'ace-builds';

ace.define(
  'ace/mode/nospace_highlight_rules',
  ['require', 'exports', 'ace/lib/oop', 'ace/mode/text_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;

    const NospaceHighlightRules = function () {
      this.$rules = {
        start: [
          { token: 'comment.block', regex: '#', next: 'comment' },
          { token: 'keyword', regex: '\\b(?:if|else|while|return|break|continue|func|let)\\b' },
          { token: 'support.function',
            regex: '\\b(?:__clog|__assert|__assert_not|__trace|__puti|__putc|__geti|__getc)\\b' },
          { token: 'string', regex: "'", next: 'string' },
          { token: 'constant.numeric', regex: '\\b[0-9]+\\b' },
          { token: 'keyword.operator', regex: '==|!=|<=|>=|&&|\\|\\||[+\\-*/%=<>!]' },
          { token: 'paren.lparen', regex: '[({]' },
          { token: 'paren.rparen', regex: '[)}]' },
          { token: 'punctuation', regex: '[;:,]' },
          { token: 'identifier', regex: '[a-zA-Z_][a-zA-Z0-9_]*' },
        ],
        comment: [
          { token: 'comment.block', regex: '#', next: 'start' },
          { defaultToken: 'comment.block' },
        ],
        string: [
          { token: 'constant.character.escape', regex: "\\\\[\\\\tns'r]" },
          { token: 'string', regex: "'", next: 'start' },
          { defaultToken: 'string' },
        ],
      };
    };
    oop.inherits(NospaceHighlightRules, TextHighlightRules);
    exports.NospaceHighlightRules = NospaceHighlightRules;
  }
);

ace.define(
  'ace/mode/nospace',
  ['require', 'exports', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/nospace_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextMode = require('ace/mode/text').Mode;
    const NospaceHighlightRules = require('ace/mode/nospace_highlight_rules').NospaceHighlightRules;

    const Mode = function () {
      this.HighlightRules = NospaceHighlightRules;
      // nospace uses { } for blocks
      this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);
    exports.Mode = Mode;
  }
);
```

### 注意事項

- `ace.define` は AMD スタイルのモジュール定義。Vite（ES modules）環境では `ace-builds/src-noconflict/ace` を先にインポートしておく必要がある
- ブロックコメント `#...#` は複数行に跨る可能性がある（state `comment` で対応）
- 将来 tmLanguage の更新があった場合は手動で Ace Mode にも反映する
