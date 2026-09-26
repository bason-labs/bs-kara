# Phase 1: bs-kara web live on AWS

**Date:** 2026-09-26
**Status:** Draft, awaiting review
**Goal:** Serve `apps/web` from our own AWS server over HTTPS, deployed automatically on push to
`main`, while Vercel keeps running unchanged. This is also a learning project: each step is done
by hand once, then automated.

## 1. Scope

In scope:

- A Docker image of `apps/web` (Next.js standalone server).
- One EC2 server in Singapore, created with Terraform.
- Caddy as the HTTPS front door, with a free Let's Encrypt certificate.
- A GitHub Actions pipeline: test, build image, push to GHCR, deploy over SSH.
- A free address first (`<ip-with-dashes>.sslip.io`), then `kara.basonlabs.com` once the domain is
  bought.

Out of scope (later phases):

| Item | Phase |
|---|---|
| Staging environment, CloudWatch monitoring and alarms, secrets in SSM, remote Terraform state | 2 |
| Jenkins | 3 |
| Kubernetes (k3s), Argo CD, Prometheus/Grafana | 4 |
| Moving off AWS (Contabo) | 5 |
| Replacing Firebase with our own database | Not planned yet |

Unchanged: Firebase RTDB/Auth, the external APIs (YouTube, Google TTS, OpenAI, Gemini), the mobile
app, and the Vercel deployment.

## 2. Architecture

### Request flow (a user opens the app)

```
Browser ── DNS: 13-212-45-67.sslip.io → 13.212.45.67
   │
   ▼ HTTPS :443
AWS security group      allows 80, 443 from anywhere; 22 per `ssh_cidrs` (see §5)
   │
   ▼
EC2 t4g.small (Ubuntu 24.04 ARM, Elastic IP)
└── docker compose
    ├── caddy      publishes 80/443 on the host; TLS + redirect + HSTS
    │     └── reverse_proxy web:3000   (private Docker network)
    └── web        bs-kara Next.js server, port 3000, NOT published on the host
          └── /api/* → YouTube, Google TTS, OpenAI, Firebase Admin (runtime secrets)

Browser ──────────────► Firebase RTDB / Auth   (direct, unchanged)
```

Port 3000 is reachable only on the internal Docker network. It has no security group rule and no
host port mapping, which also avoids the known issue where Docker port mappings bypass `ufw`.

### Deploy flow (a push to `main`)

```
git push main
  → GitHub Actions (ubuntu-24.04-arm runner, native arm64)
      1. infra/scripts/ci.sh            install, typecheck, lint, test (web)
      2. infra/scripts/build-image.sh   docker build → ghcr.io/bason-labs/bs-kara-web:<sha>, :latest
      3. infra/scripts/deploy.sh        ssh → set IMAGE_TAG=<sha> → compose pull && up -d
                                         → wait for https://<host>/api/health to report <sha>
```

The CI tool only calls the scripts. The same scripts run by hand (Step 5) and from Jenkins later
(Phase 3), which then needs only a short `Jenkinsfile`.

## 3. Components

| Component | Location | Responsibility |
|---|---|---|
| Next standalone output | `apps/web/next.config.ts` | `output: 'standalone'` and `outputFileTracingRoot` at the repo root, so the build contains a self-contained `server.js`. Vercel ignores it. |
| Health route | `apps/web/app/api/health/route.ts` | `GET` returns `{ ok: true, version }`, where `version` comes from the `APP_VERSION` env (git SHA), or `"dev"`. Used by the deploy check and for "what is live?". |
| Dockerfile | `apps/web/Dockerfile` (built from the repo root) | Multi-stage: pnpm install → turbo build of `@bs-kara/web` → a small `node:22-slim` runtime running as a non-root user. `NEXT_PUBLIC_*` values arrive as build args. |
| `.dockerignore` | repo root | Keeps `node_modules`, `.next`, `.env*`, mobile, e2e and test output out of the build context |
| Terraform | `infra/terraform/aws/` | Default VPC lookup, security group, key pair (from a local public key), EC2 `t4g.small` with a 20 GB gp3 disk, Elastic IP. Outputs the IP and the sslip.io host. Local state, gitignored. |
| Server bootstrap | `infra/server/bootstrap.sh` | Written after doing it by hand in Step 4: apt upgrade, Docker Engine and the compose plugin, `ufw` (22/80/443), unattended upgrades, fail2ban. |
| Compose stack | `infra/server/compose.yaml` and `Caddyfile` | The `caddy` and `web` services. `web` reads `/opt/bs-kara/.env` (mode 600) plus `IMAGE_TAG`. Caddy keeps its certificates in a named volume. |
| Scripts | `infra/scripts/{ci,build-image,deploy}.sh` | `bash` with `set -euo pipefail`, configured through env vars, and checked with shellcheck |
| Workflow | `.github/workflows/deploy-web.yml` | Runs on push to `main` for paths under `apps/web`, `packages/shared`, `infra` and the lockfile, and on manual dispatch |

### Environment variables

| Kind | Examples | When it's read | Where it's stored |
|---|---|---|---|
| Build-time (baked into the JS bundle) | `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PUBLIC_ORIGIN` | `docker build` (build args) | GitHub Actions variables and secrets |
| Runtime (server only) | `YOUTUBE_API_KEYS`, `GOOGLE_TTS_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `FIREBASE_ADMIN_*`, `ADMIN_EMAILS`, `AI_MC_PROVIDER` | Container start | `/opt/bs-kara/.env` on the server only |
| Deploy | `IMAGE_TAG` (git SHA), `APP_VERSION` | `deploy.sh` | Written by the deploy script |

Changing the address (sslip.io → `kara.basonlabs.com`) needs **both** a Caddyfile edit and an image
rebuild, because `NEXT_PUBLIC_SITE_URL` is baked in at build time.

The image contains no server secrets, only `NEXT_PUBLIC_*` values that are already public in any
browser bundle. It is published as a **public** GHCR package, so the server pulls it without
credentials. The repo is public, so the ARM runner is free.

## 4. Steps and pull requests

Each step that changes the repo is one PR, stacked on the previous one, per the repo convention.

| Step | What | PR | Proof it works |
|---|---|---|---|
| 1 | Standalone output, health route, Dockerfile, `.dockerignore` | PR 1 | `docker run -p 3000:3000` on the Mac: app works; `/api/health` reports the version |
| 2 | awscli and Terraform on the Mac; `aws configure sso` (admin user from IAM Identity Center) | (none) | `aws sts get-caller-identity` |
| 3 | Terraform: EC2, security group, key pair, Elastic IP | PR 2 | `terraform apply`; `ssh ubuntu@<ip>` works |
| 4 | Prepare the server **by hand** over SSH, then capture the commands in `bootstrap.sh` | PR 3 | `docker version` on the server; `ufw status` |
| 5 | First deploy **by hand**: build on the Mac (native arm64) → push to GHCR → write `.env` → compose up → Caddy obtains the certificate | PR 3 (compose, Caddyfile, scripts) | `https://<ip-dashes>.sslip.io` loads with a valid 🔒 |
| 6 | Firebase Auth → authorized domains: add the sslip.io host; check any HTTP-referrer restrictions on Google API keys | (console only) | Sign-in and OTP work on the new address |
| 7 | GitHub Actions workflow calling the scripts; repo secrets and variables | PR 4 | Push a text change → it's live and `/api/health` shows the new SHA |
| 8 | Practice: roll back to the previous SHA, read logs, check cost, `terraform destroy` + rebuild | (runbook in `infra/README.md`) | Rollback works in one command; a rebuild from git works |
| 8b | After buying `basonlabs.com`: Cloudflare A record `kara` → Elastic IP (DNS only), Caddyfile host, `NEXT_PUBLIC_SITE_URL`, Firebase authorized domain | small PR | `https://kara.basonlabs.com` has a valid 🔒 |

## 5. Error handling and safety

- **Deploy:** `deploy.sh` fails the pipeline if `/api/health` doesn't report the new SHA within
  about 90 s. The previous image stays tagged, and rolling back is `deploy.sh <previous-sha>`.
  Phase 1 accepts a few seconds of downtime while the container restarts. Zero-downtime deploys
  are for later.
- **Secrets:** never committed. `.env`, `*.tfstate*`, `*.tfvars` and private keys are gitignored.
  The owner's IP for SSH goes in a gitignored `terraform.tfvars`.
- **SSH:** key-only login, no passwords, no root login, and fail2ban. Until Step 7, port 22 is open
  only to the owner's IP (the Terraform variable `ssh_cidrs`). GitHub runner IPs change on every run,
  so Step 7 sets `ssh_cidrs` to `0.0.0.0/0`, and key-only login is what protects the server. The CI
  deploy key is a separate key pair with its own line in `authorized_keys`, so it can be revoked on
  its own. Phase 2 closes port 22 entirely and deploys through AWS SSM with a GitHub OIDC role.
- **Cost:** about $21 a month (t4g.small about $17, public IPv4 about $3.60), paid from the free
  plan credit. No NAT gateway, load balancer or EKS. A budget alert is already set up.
- **Let's Encrypt limits:** Caddy retries with backoff, and its certificate volume persists across
  restarts, so certificates aren't requested again unnecessarily.

## 6. Testing

Per the repo's CLAUDE.md:

- `next.config.ts` counts as a high-risk config change: run the full suite (typecheck, lint,
  Vitest, Playwright, `next build`) and confirm it's green.
- `app/api/health/route.ts` is a new route handler, so it gets a Vitest test: it returns
  `ok: true` with `APP_VERSION`, and falls back to `"dev"` when that isn't set.
- The Docker image gets a smoke test on the Mac: build, run, `curl /api/health`, load the home page.
- The scripts pass `shellcheck`. Terraform passes `terraform fmt -check` and `terraform validate`.
- The workflow itself is proven by a real deploy in Step 7.

## 7. Open decisions

None blocking. Chosen defaults:

- `t4g.small` (2 GB). Resize to `t4g.medium` if memory runs short.
- Local Terraform state. It moves to S3 in Phase 2, as a lesson.
- GitHub-hosted ARM runner. Jenkins takes over in Phase 3.
