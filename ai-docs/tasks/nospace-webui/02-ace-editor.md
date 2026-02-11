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

### 方針: tools ディレクトリで変換、生成結果をコミット

ace のソースリポジトリ（`ajaxorg/ace`）には `tool/tmlanguage.js` という tmLanguage → Ace Mode の変換ツールが存在する。
このツールを `tools/tmlanguage-converter/` ディレクトリに設置した変換スクリプトから利用し、
生成結果を手動調整のうえコミットする。

> **注意**: `ace-builds` npm パッケージにはこのツールは含まれない。ace ソースリポジトリが必要。

### ディレクトリ構成

```
tools/
└── tmlanguage-converter/
    ├── package.json          # 変換スクリプトの依存管理
    ├── convert.sh            # 変換実行スクリプト
    ├── ace-repo/             # ace リポジトリのクローン（.gitignore で除外）
    └── output/               # 変換結果の出力先（コミット対象）
        ├── nospace.js                    # Ace Mode 定義
        └── nospace_highlight_rules.js    # ハイライトルール
```

### .gitignore への追加

```
# tools/tmlanguage-converter: ace リポジトリのクローンと node_modules
tools/tmlanguage-converter/ace-repo/
tools/tmlanguage-converter/node_modules/
```

`tools/tmlanguage-converter/output/` はコミット対象とする。

### ツールセットアップ

#### package.json

```json
{
  "name": "tmlanguage-converter",
  "private": true,
  "description": "nospace.tmLanguage.json を Ace Editor Mode に変換するツール",
  "scripts": {
    "setup": "bash setup.sh",
    "convert": "bash convert.sh"
  }
}
```

#### setup.sh — ace リポジトリの準備

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ace-repo ]; then
  echo "Cloning ace repository..."
  git clone --depth 1 https://github.com/ajaxorg/ace.git ace-repo
fi

echo "Installing ace dependencies..."
cd ace-repo
npm install
echo "Setup complete."
```

#### convert.sh — 変換実行

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

TMLANGUAGE_PATH="../../components/nospace20/nospace.tmLanguage.json"
OUTPUT_DIR="./output"

if [ ! -d ace-repo ]; then
  echo "Error: ace-repo not found. Run 'npm run setup' first."
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Converting tmLanguage to Ace Mode..."
cd ace-repo/tool
node tmlanguage.js "../../$TMLANGUAGE_PATH"

echo "Copying generated files..."
cd ..
cp src/mode/nospace.js "../$OUTPUT_DIR/"
cp src/mode/nospace_highlight_rules.js "../$OUTPUT_DIR/"

echo "Conversion complete. Output files:"
ls -la "../$OUTPUT_DIR/"
echo ""
echo "Next steps:"
echo "  1. Review and adjust the generated files in $OUTPUT_DIR/"
echo "  2. Integrate into src/web/components/editor/nospace-ace-mode.ts"
```

### 変換手順

```bash
cd tools/tmlanguage-converter
npm run setup    # 初回のみ: ace リポジトリをクローン & 依存インストール
npm run convert  # tmLanguage → Ace Mode 変換を実行
```

### 生成結果の手動調整

変換ツールは完全ではないため、`output/` 内のファイルに以下の調整が必要になる可能性がある:

| 調整項目 | 理由 |
|---------|------|
| ステート名のリネーム | ツールは `state_2`, `state_10` のような汎用名を付けるため、`comment`, `string` 等に修正 |
| キーワードの `createKeywordMapper()` 化 | ツールがキーワードを個別ルールとして出力する場合がある |
| コメント記法の設定 | `blockComment` (`#...#`) の設定が正しいか検証 |
| 正規表現の互換性修正 | tmLanguage の正規表現と JavaScript の正規表現の差異を修正 |

調整後の `output/` ファイルをコミットする。

### Ace Mode の組み込み

生成・調整後のファイルをアプリケーションに組み込む。
Vite + ES modules 環境で動作させるため、`ace.define` を使った AMD スタイルでラップする。

#### 配置先

```
src/web/components/editor/nospace-ace-mode.ts
```

`tools/tmlanguage-converter/output/` の生成コード（CommonJS 形式）を元に、
以下のように `ace.define` でラップして配置する:

```typescript
import ace from 'ace-builds';

// output/nospace_highlight_rules.js の内容を ace.define でラップ
ace.define(
  'ace/mode/nospace_highlight_rules',
  ['require', 'exports', 'ace/lib/oop', 'ace/mode/text_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;

    const NospaceHighlightRules = function () {
      // output/nospace_highlight_rules.js の this.$rules をここに配置
      this.$rules = {
        // ... 変換ツールの出力を調整して配置 ...
      };
    };
    oop.inherits(NospaceHighlightRules, TextHighlightRules);
    exports.NospaceHighlightRules = NospaceHighlightRules;
  }
);

// output/nospace.js の内容を ace.define でラップ
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
- 将来 tmLanguage の更新があった場合は、`npm run convert` を再実行して差分を確認し、`output/` と Ace Mode に反映する
- ace リポジトリ (`ace-repo/`) と `node_modules/` は `.gitignore` で除外されるため、`npm run setup` は各開発者が初回に実行する必要がある
