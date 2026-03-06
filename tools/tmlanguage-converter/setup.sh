#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ace-repo ]; then
  echo "Cloning ace repository..."
  git clone --depth 1 https://github.com/ajaxorg/ace.git ace-repo
fi

echo "Installing ace dependencies..."
npm ci
cd ace-repo
npm i  # TODO: unnecessary?
echo "Setup complete."
