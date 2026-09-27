# Runbook — bs-kara web on AWS

Day-to-day commands for the live server. Run from the Mac in the repo folder unless marked
**server** (`ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240`, then `cd /opt/bs-kara`).

Site: https://kara.bahuynh.com (old https://54-251-27-240.sslip.io redirects here) · Server: EC2 `t4g.small`, Singapore · Deploys: GitHub
Actions on push to `main`.

## Is it healthy?

```bash
infra/scripts/status.sh      # live version, certificate expiry, containers, RAM, disk, recent errors, SSH bans
```

Healthy looks like: both containers `Up`, RAM "available" above ~500 MB, disk under 80%, no
errors, certificate more than 30 days away (Caddy renews on its own ~30 days before expiry).

## Deploy

| How | Command |
|---|---|
| Normal | merge to `main` → `gh run watch` |
| Re-run the last deploy | `gh workflow run deploy-web.yml` |
| By hand (skips tests) | `infra/scripts/build-image.sh && infra/scripts/deploy.sh` |

## Roll back

```bash
gh run list --workflow deploy-web.yml      # find the last good commit SHA
infra/scripts/deploy.sh <good-sha>         # prints "Live: <sha>" when done
```

This only changes which image runs. Then fix or revert the code on `main`, or the next push
deploys the bad change again.

## Measure downtime during a deploy

```bash
infra/scripts/probe.sh       # second tab: prints one status code per check; Ctrl+C prints the summary
```

## Logs (server)

```bash
docker compose logs --tail 100 web     # app output and errors
docker compose logs -f web             # follow live; Ctrl+C to stop
docker compose logs --tail 50 caddy    # certificates, TLS, proxy errors (502 = web is down)
docker compose ps                      # a container that keeps restarting → check its logs
```

## Measured (2026-09-27)

| What | Time |
|---|---|
| Push to `main` → live (GitHub Actions) | ~2.5 min: tests 65 s, build + push 46 s, deploy 18 s |
| `deploy.sh <sha>` by hand (rollback) | 8–11 s |
| Downtime per deploy | under 1 s (0–1 failed of ~50 checks, one every 0.5 s) |
| Memory in use | web ~60–70 MB, caddy ~12 MB; server 1.2 GB of 1.8 GB available |

## Site not loading? Check the gates in order

1. **Security group** (Terraform): ports 80/443 open → `terraform plan` shows no changes.
2. **ufw** (server): `sudo ufw status` lists 80, 443, OpenSSH.
3. **Containers** (server): `docker compose ps` — both `Up`, caddy maps 80/443.
4. **Logs**: caddy for TLS/502, web for app errors.

## Credentials

| Symptom / task | Do |
|---|---|
| `terraform`/`aws` say "expired" or "no valid credential" | `aws login` |
| Change a server secret | edit `/opt/bs-kara/.env` (**server**), then `docker compose up -d` |
| Deploy key leaked | delete the `github-actions-deploy` line in `~/.ssh/authorized_keys` (**server**), make a new key (Phase 1 notes, Step 7) |
| Updates need a reboot (`status.sh` says so) | `sudo reboot` (**server**); containers start again on their own |

## Cost

| What | Value (2026-09-27) |
|---|---|
| Spend | ~$21/month: t4g.small ~$17 + public IPv4 ~$3.60 |
| Free plan credits | $179.87 left ($100 sign-up + $20 per completed activity) |
| Free plan ends | 2027-03-25 → upgrade to paid, or the account closes |
| Budget alert | AWS Budgets, monthly cost budget, email alert |

```bash
aws freetier get-account-plan-state --region us-east-1 --query accountPlanRemainingCredits.amount   # credits left
aws freetier list-account-activities --region us-east-1 --query 'activities[].[status,title]' --output text
```

Biggest risks to the credits: a second server left running (staging), or a forgotten database.
"Terminate" deletes an instance; "Stop" keeps paying for its disk and IP.

## Rebuild the server from scratch

Needs only git plus two files on the Mac: `.env.local` (secrets) and `~/.ssh/bs-kara` (admin key).
Keep both backed up. Keeps the Elastic IP, so the address, Firebase and GitHub settings stay valid.
Measured: about 7 minutes from `terraform apply` to live (2026-09-27).

```bash
TAG=$(curl -s https://kara.bahuynh.com/api/health | sed -E 's/.*"version":"([^"]+)".*/\1/')  # or the last good SHA
cd infra/terraform/aws
terraform plan -replace=aws_instance.web -out tfplan   # 1 add, 1 change (IP moves), 1 destroy
terraform apply tfplan
cd ../../..
ssh-keygen -R 54.251.27.240                            # forget the old server's fingerprint
ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240 hostname    # "yes" to the new one (wait ~1 min for boot)
ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240 'sudo bash -s' < infra/server/bootstrap.sh
{ grep -E '^(YOUTUBE_API_KEYS|GOOGLE_TTS_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|FIREBASE_ADMIN_[A-Z_]+|ADMIN_EMAILS|AI_MC_PROVIDER|NEXT_PUBLIC_FIREBASE_[A-Z_]+)=' .env.local
  echo "SITE_HOST=kara.bahuynh.com"
  echo "IMAGE_TAG=$TAG"
} | ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240 'umask 077; cat > /opt/bs-kara/.env'
ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240 'cat >> ~/.ssh/authorized_keys' < ~/.ssh/bs-kara-deploy.pub   # GitHub deploys again
gh variable set DEPLOY_KNOWN_HOSTS --body "$(ssh-keyscan -t ed25519 54.251.27.240 2>/dev/null)"
infra/scripts/deploy.sh $TAG                           # Caddy gets a new certificate on first start
infra/scripts/status.sh
```
