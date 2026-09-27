#!/usr/bin/env bash
# One-screen health check of the live server, run from the Mac.
#   infra/scripts/status.sh
set -euo pipefail

DEPLOY_HOST=${DEPLOY_HOST:-54.251.27.240}
SITE_HOST=${SITE_HOST:-54-251-27-240.sslip.io}
SSH_KEY=${SSH_KEY:-$HOME/.ssh/bs-kara}

echo "==> Live version"
curl -fsS --max-time 5 "https://$SITE_HOST/api/health" || echo "DOWN: /api/health did not answer"
echo

echo "==> Certificate"
echo | openssl s_client -connect "$SITE_HOST:443" -servername "$SITE_HOST" 2>/dev/null \
  | openssl x509 -noout -enddate

# Everything below runs on the server.
ssh -i "$SSH_KEY" -o BatchMode=yes "ubuntu@$DEPLOY_HOST" bash <<'REMOTE'
cd /opt/bs-kara
echo "==> Containers"
docker compose ps --format '{{.Name}}  {{.Image}}  {{.Status}}'
echo "==> Resources"
docker stats --no-stream --format '{{.Name}}  cpu {{.CPUPerc}}  mem {{.MemUsage}}'
free -h | awk 'NR==2 {print "server RAM: " $7 " available of " $2}'
df -h / | awk 'NR==2 {print "disk: " $3 " used of " $2 " (" $5 ")"}'
echo "==> Web errors in the last hour"
errors=$(docker compose logs --since 1h web 2>&1 | grep -iE 'error|exception' | tail -5)
echo "${errors:-none}"
echo "==> SSH (fail2ban)"
sudo fail2ban-client status sshd | grep -E 'Total (failed|banned)'
if [ -f /var/run/reboot-required ]; then echo "!! Reboot needed for updates: sudo reboot"; fi
REMOTE
