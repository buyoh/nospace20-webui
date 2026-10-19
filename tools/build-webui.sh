#!/bin/bash

set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Error: .env.local file not found." >&2
  exit 1
fi

if [ ! -f src/web/libs/nospace20/nospace20*.wasm ]; then
  echo "Error: WASM file not found." >&2
  exit 1
fi

npm ci --ignore-scripts
npm run test
npm run build-vite
