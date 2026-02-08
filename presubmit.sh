#!/bin/bash

set -eu

yarn lint-fix
yarn test
