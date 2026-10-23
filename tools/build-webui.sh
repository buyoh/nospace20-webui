#!/bin/bash

set -eu

cd "$(dirname "$0")/.."

if [ ! -f env.local.js ]; then
  echo "Error: env.local.js file not found." >&2
  exit 1
fi

if [ ! -f src/web/libs/nospace20/nospace20*.wasm ]; then
  echo "Error: WASM file not found." >&2
  exit 1
fi

npm ci --ignore-scripts
npm run test
npm run build-vite
