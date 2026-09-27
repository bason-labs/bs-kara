#!/usr/bin/env bash
# Run an image tag on the server and wait until /api/health reports it.
#   infra/scripts/deploy.sh            # current git commit
#   infra/scripts/deploy.sh <tag>      # any pushed tag, e.g. to roll back
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TAG=${1:-$(git rev-parse --short HEAD)}
DEPLOY_HOST=${DEPLOY_HOST:-54.251.27.240}
SITE_HOST=${SITE_HOST:-54-251-27-240.sslip.io}
SSH_KEY=${SSH_KEY:-$HOME/.ssh/bs-kara}
ssh_opts=(-i "$SSH_KEY" -o BatchMode=yes)

echo "==> Copy compose.yaml and Caddyfile"
scp "${ssh_opts[@]}" infra/server/compose.yaml infra/server/Caddyfile "ubuntu@$DEPLOY_HOST:/opt/bs-kara/"

echo "==> Switch to $TAG and restart"
# shellcheck disable=SC2029 # $TAG is meant to expand on this side
ssh "${ssh_opts[@]}" "ubuntu@$DEPLOY_HOST" "cd /opt/bs-kara \
  && sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/' .env \
  && docker compose pull -q \
  && docker compose up -d \
  && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
  && docker image prune -af >/dev/null"
# prune: old images fill the disk; a rollback just pulls its tag from GHCR again.

echo "==> Wait for https://$SITE_HOST/api/health to report $TAG"
for _ in $(seq 1 30); do
  if curl -fsS "https://$SITE_HOST/api/health" 2>/dev/null | grep -q "\"version\":\"$TAG\""; then
    echo "Live: $TAG (deploy took ${SECONDS}s)"
    exit 0
  fi
  sleep 3
done
echo "Timed out: $TAG is not live. Roll back with: infra/scripts/deploy.sh <previous-tag>" >&2
exit 1
