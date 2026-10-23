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
            include: '#types',
          },
          {
            include: '#builtins',
          },
          {
            include: '#strings',
          },
          {
            include: '#double-strings',
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
            include: '#struct-definition',
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
            regex: /\b(?:if|else|while|repeat|for|return|break|continue)\b/,
          },
          {
            token: 'keyword.declaration.nospace',
            regex:
              /\b(?:func|let|static|final|constexpr|alias|struct|namespace|import|weak|export)\b/,
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
                regex: /\\x[0-9A-Fa-f]+/,
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
            token: 'constant.numeric.hex.nospace',
            regex: /\b0x[0-9A-Fa-f]+\b/,
          },
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
            token: 'keyword.operator.assignment.compound.nospace',
            regex: /\+=|\-=|\*=|\/=|%=/,
          },
          {
            token: 'keyword.operator.assignment.nospace',
            regex: /=/,
          },
          {
            token: 'keyword.operator.reference.nospace',
            regex: /&/,
          },
          {
            token: 'keyword.operator.type-annotation.nospace',
            regex: /@/,
          },
          {
            token: 'keyword.operator.field-access.nospace',
            regex: /\./,
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
          {
            token: 'punctuation.section.brackets.begin.nospace',
            regex: /\[/,
          },
          {
            token: 'punctuation.section.brackets.end.nospace',
            regex: /\]/,
          },
          {
            token: 'punctuation.accessor.namespace.nospace',
            regex: /\$/,
          },
        ],
        '#double-strings': [
          {
            token: 'punctuation.definition.string.begin.nospace',
            regex: /"/,
            push: [
              {
                token: 'punctuation.definition.string.end.nospace',
                regex: /"/,
                next: 'pop',
              },
              {
                token: 'constant.character.escape.nospace',
                regex: /\\./,
              },
              {
                defaultToken: 'string.quoted.double.nospace',
              },
            ],
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
        '#struct-definition': [
          {
            token: [
              'keyword.declaration.struct.nospace',
              'text',
              'entity.name.type.struct.nospace',
              'text',
            ],
            regex: /\b(struct)(\s*:\s*)([A-Z][a-zA-Z0-9_]*)(\s*\()/,
          },
        ],
        '#types': [
          {
            token: 'support.type.primitive.nospace',
            regex: /(?<=@)\s*\b(?:int|void)\b/,
          },
          {
            token: 'entity.name.type.nospace',
            regex: /(?<=@)\s*\b[A-Z][a-zA-Z0-9_]*\b/,
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
