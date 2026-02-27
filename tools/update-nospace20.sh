#!/bin/bash

NOSPACE20_DIR=../nospace20

if [ -n "$1" ]; then
  NOSPACE20_DIR="$1"
fi

NOSPACE20_DIR="$(realpath "$NOSPACE20_DIR")"

if [ ! -d "$NOSPACE20_DIR" ]; then
  echo "Error: Directory '$NOSPACE20_DIR' does not exist." >&2
  exit 1
fi

if [ ! -f "$NOSPACE20_DIR/build-wasm.sh" ]; then
  echo "Error: File '$NOSPACE20_DIR/build-wasm.sh' does not exist." >&2
  exit 1
fi

set -eu

cd "$(dirname "$0")/.."

pushd "$NOSPACE20_DIR" > /dev/null
bash ./build-wasm.sh
cd tools/vscode-ext
npm ci
npm run build-ext
popd > /dev/null

set -x
cp "$NOSPACE20_DIR/tools/vscode-ext/dist/nospace-lang/syntaxes/nospace.tmLanguage.json" \
  components/nospace20/nospace.tmLanguage.json
cp "$NOSPACE20_DIR/pkg/nospace20"* \
  src/web/libs/nospace20
set +x

bash tools/tmlanguage-converter/convert.sh
