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
