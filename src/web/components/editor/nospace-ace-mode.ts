import ace from 'ace-builds';

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

      this.$rules = {
        start: [
          {
            include: '#comments',
          },
          {
            include: '#keywords',
          },
          {
            include: '#builtins',
          },
          {
            include: '#strings',
          },
          {
            include: '#numbers',
          },
          {
            include: '#operators',
          },
          {
            include: '#punctuation',
          },
          {
            include: '#function-definition',
          },
          {
            include: '#function-call',
          },
          {
            include: '#variables',
          },
        ],
        '#comments': [
          {
            token: 'punctuation.definition.comment.begin.nospace',
            regex: /#/,
            push: [
              {
                token: 'punctuation.definition.comment.end.nospace',
                regex: /#/,
                next: 'pop',
              },
              {
                defaultToken: 'comment.block.nospace',
              },
            ],
          },
        ],
        '#keywords': [
          {
            token: 'keyword.control.nospace',
            regex: /\b(?:if|else|while|return|break|continue)\b/,
          },
          {
            token: 'keyword.declaration.nospace',
            regex: /\b(?:func|let)\b/,
          },
        ],
        '#builtins': [
          {
            token: 'support.function.debug.nospace',
            regex: /\b(?:__clog|__assert|__assert_not|__trace)\b/,
          },
          {
            token: 'support.function.io.nospace',
            regex: /\b(?:__puti|__putc|__geti|__getc)\b/,
          },
        ],
        '#strings': [
          {
            token: 'punctuation.definition.string.begin.nospace',
            regex: /'/,
            push: [
              {
                token: 'punctuation.definition.string.end.nospace',
                regex: /'/,
                next: 'pop',
              },
              {
                token: 'constant.character.escape.nospace',
                regex: /\\[\\tns'r]/,
              },
              {
                defaultToken: 'string.quoted.single.nospace',
              },
            ],
          },
        ],
        '#numbers': [
          {
            token: 'constant.numeric.integer.nospace',
            regex: /\b[0-9]+\b/,
          },
        ],
        '#operators': [
          {
            token: 'keyword.operator.comparison.nospace',
            regex: /==|!=|<=|>=|<|>/,
          },
          {
            token: 'keyword.operator.logical.nospace',
            regex: /&&|\|\||!/,
          },
          {
            token: 'keyword.operator.arithmetic.nospace',
            regex: /[+\-*\/%]/,
          },
          {
            token: 'keyword.operator.assignment.nospace',
            regex: /=/,
          },
        ],
        '#punctuation': [
          {
            token: 'punctuation.separator.colon.nospace',
            regex: /:/,
          },
          {
            token: 'punctuation.separator.comma.nospace',
            regex: /,/,
          },
          {
            token: 'punctuation.terminator.semicolon.nospace',
            regex: /;/,
          },
          {
            token: 'punctuation.section.braces.begin.nospace',
            regex: /\{/,
          },
          {
            token: 'punctuation.section.braces.end.nospace',
            regex: /\}/,
          },
          {
            token: 'punctuation.section.parens.begin.nospace',
            regex: /\(/,
          },
          {
            token: 'punctuation.section.parens.end.nospace',
            regex: /\)/,
          },
        ],
        '#function-definition': [
          {
            token: [
              'keyword.declaration.function.nospace',
              'text',
              'entity.name.function.nospace',
              'text',
            ],
            regex: /\b(func)(\s*:\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*\()/,
          },
        ],
        '#function-call': [
          {
            token: ['entity.name.function.call.nospace', 'text'],
            regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)(\s*\()/,
          },
        ],
        '#variables': [
          {
            token: 'variable.other.nospace',
            regex: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/,
          },
        ],
      };

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
      this.blockComment = { start: '#', end: '#' };
      this.$id = 'ace/mode/nospace';
    }).call(Mode.prototype);
    exports.Mode = Mode;
  }
);
