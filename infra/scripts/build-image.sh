#!/usr/bin/env bash
# Build the web image and push it to GHCR, tagged with the current git commit.
#   infra/scripts/build-image.sh
# NEXT_PUBLIC_* values come from the environment (CI) or, when unset, from .env.local.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

IMAGE=${IMAGE:-ghcr.io/bason-labs/bs-kara-web}
TAG=${TAG:-$(git rev-parse --short HEAD)}
SITE_URL=${NEXT_PUBLIC_SITE_URL:-https://kara.bahuynh.com}

# The tag names a commit, so the image must be built from exactly that commit.
if ! git diff --quiet HEAD -- apps/web packages/shared pnpm-lock.yaml; then
  echo "Uncommitted app changes: commit first so the image matches its tag." >&2
  exit 1
fi

build_args=(--build-arg "NEXT_PUBLIC_SITE_URL=$SITE_URL")
for key in NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
  NEXT_PUBLIC_FIREBASE_DATABASE_URL NEXT_PUBLIC_FIREBASE_PROJECT_ID NEXT_PUBLIC_FIREBASE_APP_ID; do
  value=${!key:-}
  if [[ -z $value && -f .env.local ]]; then
    value=$(grep "^$key=" .env.local | cut -d= -f2- || true)
  fi
  if [[ -z $value ]]; then
    echo "Missing $key" >&2
    exit 1
  fi
  build_args+=(--build-arg "$key=$value")
done

docker build -f apps/web/Dockerfile "${build_args[@]}" -t "$IMAGE:$TAG" .
docker push "$IMAGE:$TAG"
echo "Pushed $IMAGE:$TAG"
