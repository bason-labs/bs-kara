# Phase 1: bs-kara web on AWS — command notes

Short notes of what was run, in order. Design and reasons: `docs/superpowers/specs/2026-09-26-phase1-aws-deploy-design.md`.

Server: EC2 `t4g.small` (Ubuntu 24.04 ARM), Singapore, Elastic IP `54.251.27.240`,
address `54-251-27-240.sslip.io`.

## Step 1 — Docker image (on the Mac)

```bash
docker build -f apps/web/Dockerfile -t bs-kara-web .    # build from the repo root
docker run --rm -p 3000:3000 --env-file .env.local bs-kara-web
curl localhost:3000/api/health                          # {"ok":true,"version":"dev"}
```

## Step 2 — Tools and AWS login (on the Mac)

```bash
brew install awscli                         # AWS command-line tool
brew install hashicorp/tap/terraform        # Terraform, from HashiCorp's own tap
aws configure set region ap-southeast-1     # default region: Singapore
aws login                                   # short-lived credentials, no access keys on disk
aws sts get-caller-identity                 # should show user/bason-admin
ssh-keygen -t ed25519 -f ~/.ssh/bs-kara -C bs-kara-admin   # SSH key pair for the server
```

AWS console (once): IAM user `bason-admin` with `AdministratorAccess` + MFA. Root account only
for billing.

## Step 3 — Create the server with Terraform (on the Mac)

```bash
cd infra/terraform/aws
cp terraform.tfvars.example terraform.tfvars  # put your IP in ssh_cidrs (curl ifconfig.me)
terraform init                  # download the AWS provider
terraform fmt && terraform validate
terraform plan -out tfplan      # preview what will be created
terraform apply tfplan          # create it; IDs are saved in terraform.tfstate
terraform output                # public_ip, sslip_host, ssh_command
```

Terraform runs on the Mac, reads the `.tf` files, and calls the AWS APIs. `terraform.tfstate`
remembers what exists, so the next `apply` only does the difference.

## Step 4 — Prepare the server (over SSH)

```bash
ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240    # log in; your key is checked against authorized_keys
```

### 4.1 Update the system

```bash
sudo apt update                 # refresh the package list (installs nothing)
sudo apt upgrade -y             # install updates; on the purple "restart services" screen press Enter
cat /var/run/reboot-required    # file exists → sudo reboot; "No such file" → no reboot needed
```

### 4.2 Docker (official Docker repo)

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc   # Docker's signing key
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null     # add Docker's package source
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu  # use docker without sudo; log out and back in to apply
docker version && docker compose version
docker run --rm hello-world     # prints "Hello from Docker!"
```

If apt can't find one package name, it installs nothing — check for typos.

### 4.3 Firewall (ufw) — second lock behind the AWS security group

```bash
sudo ufw default deny incoming     # block everything coming in
sudo ufw default allow outgoing    # the server can still reach the internet
sudo ufw allow OpenSSH             # port 22 — allow this BEFORE enabling, or you lock yourself out
sudo ufw allow 80/tcp              # HTTP: redirect + Let's Encrypt check
sudo ufw allow 443/tcp             # HTTPS
sudo ufw enable                    # answer y
sudo ufw status verbose
```

Keep the SSH window open and test a new SSH login in another tab; if it fails, `sudo ufw disable`.

### 4.4 Auto security updates + fail2ban

```bash
sudo apt install -y unattended-upgrades fail2ban
cat /etc/apt/apt.conf.d/20auto-upgrades    # both lines "1" = refresh + install security fixes daily
                                           # (if not: sudo dpkg-reconfigure -plow unattended-upgrades → Yes)
sudo systemctl enable --now fail2ban       # start now and on every boot
sudo fail2ban-client status sshd           # SSH jail: failed logins and banned IPs
```

Default sshd jail: 5 failed logins in 10 min → IP banned for 10 min. Shows 0 while port 22 is
open only to our IP; bans appear once port 22 opens to all (Step 7).

### 4.5 Harden SSH — key-only, no root

```bash
sudo tee /etc/ssh/sshd_config.d/10-hardening.conf > /dev/null <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
X11Forwarding no
CONF
sudo sshd -t && echo "config OK"    # syntax check before applying
sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|maxauthtries|x11forwarding) '
sudo systemctl reload ssh           # apply; current session stays open
```

Files in `sshd_config.d/` are read in name order and the first value wins, so `10-` beats Ubuntu's
`60-cloudimg-settings.conf`. Test from the **Mac** (not the server — the security group drops it):
`ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password ubuntu@54.251.27.240` →
`Permission denied (publickey)`.

### All of Step 4 in one command

`infra/server/bootstrap.sh` repeats 4.1–4.5 and is safe to run again:

```bash
ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240 'sudo bash -s' < infra/server/bootstrap.sh
```
