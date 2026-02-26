#!/usr/bin/env node
/**
 * output/nospace_highlight_rules.js と output/nospace.js から
 * nospace-ace-mode.ts を生成するスクリプト
 *
 * Usage: node generate-ace-mode-ts.js [--output <path>]
 *   デフォルト出力先: ../../src/web/libs/nospace20/nospace-ace-mode.ts
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const HIGHLIGHT_RULES_PATH = path.join(SCRIPT_DIR, 'output', 'nospace_highlight_rules.js');
const MODE_PATH = path.join(SCRIPT_DIR, 'output', 'nospace.js');
const DEFAULT_OUTPUT = path.join(SCRIPT_DIR, '..', '..', 'src', 'web', 'libs', 'nospace20', 'nospace-ace-mode.ts');

function parseArgs() {
  const args = process.argv.slice(2);
  let output = DEFAULT_OUTPUT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      output = path.resolve(args[i + 1]);
      i++;
    }
  }
  return { output };
}

/**
 * nospace_highlight_rules.js から this.$rules = { ... } ブロックと
 * normalizeRules 呼び出しを抽出する
 */
function extractHighlightRulesBody(source) {
  // ライセンスヘッダー・require・変数宣言を除去して、関数本体を取得
  // this.$rules = { ... } を抽出
  const rulesMatch = source.match(/this\.\$rules\s*=\s*\{/);
  if (!rulesMatch) {
    throw new Error('Could not find this.$rules in nospace_highlight_rules.js');
  }

  const startIdx = rulesMatch.index;
  // ブレースのバランスで終端を探す
  let depth = 0;
  let endIdx = startIdx;
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  const rulesBlock = source.substring(startIdx, endIdx);
  return rulesBlock;
}

/**
 * nospace.js から blockComment 設定を抽出する
 */
function extractModeConfig(source) {
  // lineCommentStart を探す（コメントアウトされている場合もある）
  const blockCommentMatch = source.match(/this\.blockComment\s*=\s*\{[^}]+\}/);
  const lineCommentMatch = source.match(/this\.lineCommentStart\s*=\s*"[^"]*"/);

  const config = {};
  if (blockCommentMatch) {
    config.blockComment = blockCommentMatch[0];
  }
  if (lineCommentMatch && !source.includes('// this.lineCommentStart')) {
    config.lineComment = lineCommentMatch[0];
  }

  return config;
}

function generateAceModeTs(rulesBlock, modeConfig) {
  // modeConfig から blockComment の行を組み立て
  let modeConfigLines = '';
  // nospace のコメントは # ... # なので blockComment を設定
  modeConfigLines = "      this.blockComment = { start: '#', end: '#' };";

  const output = `import ace from 'ace-builds';

// nospace_highlight_rules.js の内容を ace.define でラップ
ace.define(
  'ace/mode/nospace_highlight_rules',
  ['require', 'exports', 'ace/lib/oop', 'ace/mode/text_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextHighlightRules =
      require('ace/mode/text_highlight_rules').TextHighlightRules;

    const NospaceHighlightRules = function () {
      // regexp must not have capturing parentheses. Use (?:) instead.
      // regexps are ordered -> the first match is used

      ${rulesBlock}

      this.normalizeRules();
    };

    oop.inherits(NospaceHighlightRules, TextHighlightRules);
    exports.NospaceHighlightRules = NospaceHighlightRules;
  }
);

// nospace.js の内容を ace.define でラップ
ace.define(
  'ace/mode/nospace',
  [
    'require',
    'exports',
    'ace/lib/oop',
    'ace/mode/text',
    'ace/mode/nospace_highlight_rules',
  ],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextMode = require('ace/mode/text').Mode;
    const NospaceHighlightRules =
      require('ace/mode/nospace_highlight_rules').NospaceHighlightRules;

    const Mode = function () {
      this.HighlightRules = NospaceHighlightRules;
      this.$behaviour = this.$defaultBehaviour;
    };
    oop.inherits(Mode, TextMode);
    (function () {
${modeConfigLines}
      this.$id = 'ace/mode/nospace';
    }).call(Mode.prototype);
    exports.Mode = Mode;
  }
);
`;

  return output;
}

/**
 * $rules ブロックを整形する（2スペースインデント、トレイリングカンマ付き）
 */
function formatRulesBlock(rulesBlock) {
  // JSON-likeなオブジェクトを整形するため、正規表現ではなくそのまま使う
  // ただし、4スペースインデントに整形し直す

  // 行ごとに分解してインデントを調整
  const lines = rulesBlock.split('\n');
  const formatted = [];

  for (const line of lines) {
    // 元のインデントを削除して再インデント
    const trimmed = line.replace(/^\s+/, '');
    if (trimmed === '') continue;

    // インデントレベルを検出（元のインデント幅から推定）
    const origIndent = line.match(/^(\s*)/)[1].length;
    // 最小限のインデント調整: そのまま利用する
    formatted.push(line);
  }

  return formatted.join('\n');
}

function main() {
  const { output } = parseArgs();

  // 入力ファイルの存在チェック
  if (!fs.existsSync(HIGHLIGHT_RULES_PATH)) {
    console.error(`Error: ${HIGHLIGHT_RULES_PATH} not found. Run 'npm run convert' first.`);
    process.exit(1);
  }
  if (!fs.existsSync(MODE_PATH)) {
    console.error(`Error: ${MODE_PATH} not found. Run 'npm run convert' first.`);
    process.exit(1);
  }

  const highlightSource = fs.readFileSync(HIGHLIGHT_RULES_PATH, 'utf-8');
  const modeSource = fs.readFileSync(MODE_PATH, 'utf-8');

  const rulesBlock = extractHighlightRulesBody(highlightSource);
  const modeConfig = extractModeConfig(modeSource);

  const tsContent = generateAceModeTs(rulesBlock, modeConfig);

  fs.writeFileSync(output, tsContent, 'utf-8');
  console.log(`Generated: ${output}`);
}

main();
