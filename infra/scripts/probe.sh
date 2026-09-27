#!/usr/bin/env bash
# Call /api/health twice a second and count failures, to measure downtime
# during a deploy. Run it in a second tab; stop with Ctrl+C (or set DURATION).
#   infra/scripts/probe.sh
#   DURATION=60 infra/scripts/probe.sh
set -uo pipefail

SITE_HOST=${SITE_HOST:-kara.bahuynh.com}
DURATION=${DURATION:-0} # seconds; 0 = until Ctrl+C
total=0
failed=0

summary() {
  echo
  echo "checks: $total, failed: $failed (about $((failed / 2)) s of downtime)"
  exit 0
}
trap summary INT

while [[ $DURATION -eq 0 || $SECONDS -lt $DURATION ]]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "https://$SITE_HOST/api/health")
  total=$((total + 1))
  [[ $code == 200 ]] || failed=$((failed + 1))
  echo "$(date +%T) $code"
  sleep 0.5
done
summary
