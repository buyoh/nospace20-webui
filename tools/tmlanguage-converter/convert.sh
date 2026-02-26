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

echo "Intermediate files:"
ls -la "../$OUTPUT_DIR/"

cd ..
echo ""
echo "Generating nospace-ace-mode.ts..."
node generate-ace-mode-ts.js

echo "Formatting with prettier..."
REPO_ROOT="$(cd ../.. && pwd)"
npx --prefix "$REPO_ROOT" prettier --write "$REPO_ROOT/src/web/libs/nospace20/nospace-ace-mode.ts"

echo "Done."
