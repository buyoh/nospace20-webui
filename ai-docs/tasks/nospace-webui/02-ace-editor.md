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

nospace の syntax 定義は TextMate Grammar 形式（`components/nospace20/nospace.tmLanguage.json`）で提供されている。
Ace Editor は独自の highlight ルール形式を使うため、変換が必要。

### 方針: ace リポジトリの変換ツールを使用し、生成結果を手動調整

ace のソースリポジトリ（`ajaxorg/ace`）には `tool/tmlanguage.js` という tmLanguage → Ace Mode の変換ツールが存在する。
このツールを使って初期変換を行い、生成されたコードを手動で調整・組み込む。

> **注意**: `ace-builds` npm パッケージにはこのツールは含まれない。ace ソースリポジトリをクローンして使う必要がある。

### 変換手順

#### 1. ace リポジトリの変換ツールを準備

```bash
# ace ソースリポジトリをクローン（ツール利用のみ）
git clone --depth 1 https://github.com/ajaxorg/ace.git tmp/ace-tool
cd tmp/ace-tool
npm install
```

#### 2. tmLanguage ファイルを変換

```bash
# .tmLanguage.json (JSON形式) を入力として変換
cd tmp/ace-tool/tool
node tmlanguage.js ../../../components/nospace20/nospace.tmLanguage.json
```

変換ツールは 2 つのファイルを生成する:
- `src/mode/nospace.js` — Ace Mode 定義
- `src/mode/nospace_highlight_rules.js` — ハイライトルール

#### 3. 生成結果の手動調整

変換ツールは完全ではないため、以下の調整が必要になる可能性がある:

| 調整項目 | 理由 |
|---------|------|
| ステート名のリネーム | ツールは `state_2`, `state_10` のような汎用名を付けるため、`comment`, `string` 等に修正 |
| キーワードの `createKeywordMapper()` 化 | ツールがキーワードを個別ルールとして出力する場合がある |
| コメント記法の設定 | `blockComment` (`#...#`) の設定が正しいか検証 |
| 正規表現の互換性修正 | tmLanguage の正規表現と JavaScript の正規表現の差異を修正 |

#### 4. Ace Mode ファイルの配置と組み込み

生成・調整後のコードをプロジェクト内に配置する。
Vite + ES modules 環境で動作させるため、`ace.define` を使った AMD スタイルでラップする。

### Ace Mode 実装ファイル

```
src/web/components/editor/nospace-ace-mode.ts
```

変換ツールの出力を元に、以下のように `ace.define` でラップして配置する:

```typescript
import ace from 'ace-builds';

// ツール生成の highlight rules を ace.define でラップ
ace.define(
  'ace/mode/nospace_highlight_rules',
  ['require', 'exports', 'ace/lib/oop', 'ace/mode/text_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;

    const NospaceHighlightRules = function () {
      // ツール生成の this.$rules をここに貼り付け・調整
      this.$rules = {
        // ... 変換ツールの出力を調整して配置 ...
      };
    };
    oop.inherits(NospaceHighlightRules, TextHighlightRules);
    exports.NospaceHighlightRules = NospaceHighlightRules;
  }
);

// ツール生成の mode 定義を ace.define でラップ
ace.define(
  'ace/mode/nospace',
  ['require', 'exports', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/nospace_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextMode = require('ace/mode/text').Mode;
    const NospaceHighlightRules = require('ace/mode/nospace_highlight_rules').NospaceHighlightRules;

    const Mode = function () {
      this.HighlightRules = NospaceHighlightRules;
      this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);
    (function () {
      this.blockComment = { start: '#', end: '#' };
      this.$id = 'ace/mode/nospace';
    }).call(Mode.prototype);
    exports.Mode = Mode;
  }
);
```

### tmLanguage のパターン分析（参照用）

変換ツールの出力を検証する際の参考として、`nospace.tmLanguage.json` のルール概要を以下に示す:

| カテゴリ | パターン | tmLanguage scope |
|---------|---------|-----------------|
| コメント | `#...#` | `comment.block.nospace` |
| キーワード (制御) | `if`, `else`, `while`, `return`, `break`, `continue` | `keyword.control.nospace` |
| キーワード (宣言) | `func`, `let` | `keyword.declaration.nospace` |
| ビルトイン (デバッグ) | `__clog`, `__assert`, `__assert_not`, `__trace` | `support.function.debug.nospace` |
| ビルトイン (IO) | `__puti`, `__putc`, `__geti`, `__getc` | `support.function.io.nospace` |
| 文字列 | `'...'`（エスケープ: `\\`, `\t`, `\n`, `\s`, `\'`, `\r`） | `string.quoted.single.nospace` |
| 数値 | `[0-9]+` | `constant.numeric.integer.nospace` |
| 演算子 | `==`, `!=`, `<=`, `>=`, `&&`, `\|\|`, `+`, `-`, `*`, `/`, `%`, `=`, `!` | `keyword.operator.*` |
| 区切り | `:`, `,`, `;`, `{`, `}`, `(`, `)` | `punctuation.*` |
| 関数定義 | `func:name(` | `keyword.declaration` + `entity.name.function` |
| 関数呼び出し | `name(` | `entity.name.function.call` |
| 変数 | `[a-zA-Z_][a-zA-Z0-9_]*` | `variable.other.nospace` |

### 注意事項

- `ace.define` は AMD スタイルのモジュール定義。Vite（ES modules）環境では `ace-builds/src-noconflict/ace` を先にインポートしておく必要がある
- ブロックコメント `#...#` は複数行に跨る可能性がある（ステート遷移で対応）
- 変換ツールで生成したコードは `tmp/ace-tool/` に出力される。`tmp/` はリポジトリから除外されている前提
- 将来 tmLanguage の更新があった場合は、再度変換ツールを実行して差分を確認し、Ace Mode に反映する
