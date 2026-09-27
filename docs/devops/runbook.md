# Runbook — bs-kara web on AWS

Day-to-day commands for the live server. Run from the Mac in the repo folder unless marked
**server** (`ssh -i ~/.ssh/bs-kara ubuntu@54.251.27.240`, then `cd /opt/bs-kara`).

Site: https://54-251-27-240.sslip.io · Server: EC2 `t4g.small`, Singapore · Deploys: GitHub
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
