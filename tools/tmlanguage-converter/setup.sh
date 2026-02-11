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
