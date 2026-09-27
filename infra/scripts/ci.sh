#!/usr/bin/env bash
# Checks that must pass before an image is built: install, typecheck, lint, test
# for the web app and the shared package it uses.
#   infra/scripts/ci.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

pnpm install --frozen-lockfile --filter @bs-kara/web...
pnpm -C apps/web exec next typegen # route types for tsc, without a full build
pnpm exec turbo run typecheck lint test --filter=@bs-kara/web...
