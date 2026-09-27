#!/usr/bin/env bash
# Prepare a fresh Ubuntu 24.04 server for bs-kara: updates, Docker, firewall,
# auto security updates, fail2ban, key-only SSH. Safe to run again.
#
# From the Mac:
#   ssh -i ~/.ssh/bs-kara ubuntu@<ip> 'sudo bash -s' < infra/server/bootstrap.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash bootstrap.sh" >&2
  exit 1
fi

# No interactive prompts (apt questions, the "restart services?" screen).
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

echo "==> Update the system"
apt-get update
apt-get upgrade -y

echo "==> Docker (official repo)"
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
# shellcheck source=/dev/null
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu

echo "==> Firewall: allow only SSH, HTTP, HTTPS"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Auto security updates + fail2ban"
apt-get install -y unattended-upgrades fail2ban
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now fail2ban

echo "==> SSH: key-only, no root"
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
X11Forwarding no
EOF
sshd -t
systemctl reload ssh

echo "==> App folder"
install -d -o ubuntu -g ubuntu /opt/bs-kara  # deploy.sh copies compose.yaml and Caddyfile here

echo "==> Done"
if [[ -f /var/run/reboot-required ]]; then
  echo "A reboot is needed to finish updates: sudo reboot"
fi
