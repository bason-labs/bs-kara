# ACDC Automation for bs-kara — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorm) — pending spec review
**Version:** v2 (incorporates a fact-check + 6-lens adversarial review pass; see
Appendix B for the verified facts and Appendix C for the resolved findings)
**Author:** ba.huynh@gradion.com (with Claude Code)
**Subject repo:** `github.com/bason-labs/bs-kara` (PUBLIC; account has ADMIN)

## Purpose

Bring the **Agent-Centric Development Cycle (ACDC)** — proven in
`gradionhq/acdc-poc` — to the `bs-kara` karaoke monorepo so that **creating a
ticket on a board automatically drives a local Claude Code agent to take it to a
pull request**, under three hard constraints:

1. **Agent work runs locally on the Claude subscription** — no Anthropic API key,
   no metered API billing. Generation, review, and resolution run through the
   logged-in `claude` CLI on the user's Mac.
2. **Everything in the git/CI stack is free** — only free GitHub features and free
   public-repo tiers of third-party tools.
3. **Ticket-triggered** — opening an `agent-ready` ticket in the board's *Todo*
   column is the trigger; the agent picks it up with no further human action.

`bs-kara` being **public** is what makes constraint #2 achievable (unlimited
Actions minutes; SonarCloud + CodeRabbit free tiers for public repos).

> **Critical caveat surfaced during verification (must be resolved in Phase 0).**
> A headless `claude -p` run on this machine returned `total_cost_usd` and
> `service_tier: standard` in its JSON, and there is a known, Anthropic-labeled bug
> (anthropics/claude-code #43333) where `claude -p` over subscription OAuth can be
> routed to per-token API billing instead of the subscription. Constraint #1 is
> therefore **unproven until measured**: Phase 0 must run one real ticket and
> confirm via the **account usage dashboard** (not the JSON `total_cost_usd` field)
> that usage drew only on the subscription window. If `-p` meters against API
> billing here, constraint #1 fails and the approach must be revisited.

## Repository reality (verified, corrects the stale CLAUDE.md)

`bs-kara` is a **pnpm@10.11 + turbo monorepo**, *not* a single npm package. The
root `CLAUDE.md` describes only `bk-web` and lists `npm run …` commands that are
**stale** — the real toolchain is pnpm + turbo. Workspaces:

| Workspace | Package | What it is |
|---|---|---|
| `bk-web` | `@bs-kara/web` | Next.js 15 karaoke app (the `CLAUDE.md` subject) |
| `bk-mobile` | `@bs-kara/mobile` | Expo / React Native app |
| `bk-shared` | — | shared code |

Lockfile: `pnpm-lock.yaml` (no `package-lock.json` — `npm ci` would fail).
Root scripts: `turbo dev/build/lint/test/typecheck` (filtered, e.g.
`dev = turbo dev --filter=@bs-kara/web`). `bk-web` scripts: `next dev/build/start`,
`eslint` (lint), `vitest run` (test), `playwright test` (test:e2e), plus
`test:rules` / `test:rules:emulator` (Firebase rules via the `demo-bs-kara`
emulator). `playwright.config.ts`, `e2e/`, and `database.rules.json` live at repo
root.

**Phase 1 must update the stale root `CLAUDE.md` command list** as part of fixing
the Guide context the runbook relies on.

## What ACDC is (adopted from the POC)

`gradionhq/acdc-poc` is a notes app used as the *subject* of an experiment; the
real artifact is the **autonomous loop**, documented on its `experiment-control`
branch (`docs/superpowers/`). Proven, relevant facts:

- **Orchestrator = a local Claude Code session** (the user's subscription) — *not*
  `claude-code-action`, *not* an API key.
- **Workers = agents in git worktrees** — one implementer per ticket, plus
  resolver/sync workers.
- **Trigger = GitHub `agent-ready` issues on a GitHub Projects (v2) board** with a
  Status field (Todo → In Progress → In review → Done).
- **Loop:** pick ticket → In Progress → implement in a worktree + add a Playwright
  e2e (video proof-of-work) → green bar → open PR → review → resolve blocking
  findings → merge-on-green → free the slot → next ticket.

### What we adopt vs. drop

| Piece | POC used | This project |
|---|---|---|
| Generation (agent) | Claude Code (subscription) | **same — local subscription** |
| Code review | Gitar + CodeRabbit + Sonar (paid) | **Claude in-session adversarial review** (mandatory) + CodeRabbit + SonarCloud **free tiers** (see gate policy) |
| Quality gate | SonarCloud Team (paid) | **GitHub Actions CI** (mandatory) + SonarCloud free + CodeRabbit free |
| Board + Issues + PRs | GitHub | **same — free** |
| Trigger runtime | interactive `claude` | **launchd watcher → headless `claude -p`** on login |

## Constraints & decisions (locked during brainstorming + verification)

- **Target:** `bs-kara` (the monorepo); Phase 2 proves on a `bk-web` ticket.
- **Board:** a GitHub Projects (v2) board with a `Status` single-select field.
- **Trigger runtime:** a macOS **launchd LaunchAgent** that starts on login and
  runs a watcher loop; the watcher dispatches a **headless `claude -p`** per
  ticket. Runs only while the Mac is awake and the user is logged in.
- **Quality gates:** GitHub CI + SonarCloud free + CodeRabbit free + a Claude
  in-session adversarial self-review. **Mandatory vs. advisory split is defined in
  "Gate policy" below** (not all gates are equal for the merge decision).
- **Merge autonomy:** default **open-PR-and-stop**; **auto-merge only when the
  ticket carries the `auto-merge` label** AND the hard safety prerequisites
  (branch protection + server-side `--auto` merge) are in place. **Until branch
  protection exists, the `auto-merge` label is inert** (everything stops at the PR).
- **Concurrency:** **cap = 1 (serial) through Phase 3**; raised to a configurable
  `≤3` only in Phase 4 once conflict-recovery is hardened. (The "prefer
  non-overlapping areas" logic is built and unit-tested in Phase 3 but only
  exercised end-to-end in Phase 4.)

## Free / subscription mapping (the core promise — see Phase-0 billing gate)

| Function | Runs on | Cost |
|---|---|---|
| Generate / self-review / resolve | local headless `claude` (subscription) | free *if Phase-0 billing check passes* |
| CI: typecheck, lint, vitest, build, Playwright e2e | GitHub Actions (public repo) | free (unlimited minutes) |
| Static analysis | SonarCloud (public project) | free tier (default gate; PR analysis only when target is `main`) |
| 2nd-opinion PR review | CodeRabbit **Open Source** plan (public repo) | free (lower/variable rate limits) |
| Board / Issues / PRs | GitHub | free |
| Trigger runtime | macOS launchd | free (OS) |

## Architecture (Approach A — launchd watcher + headless `claude -p` per ticket)

Alternatives considered:
- **B — self-hosted GitHub Actions runner** (event-driven on `issues.labeled` /
  `check_suite.completed`): genuinely event-driven and a runner *also* uses the
  local subscription, but adds a runner service to keep alive. **Reconsider sooner
  than originally planned** — the review noted launchd `KeepAlive` is itself a
  service, and event-driven conserves the scarcest resource (subscription
  windows). Kept as the documented Phase-4+ alternative.
- **C — pure manual `/acdc` command** (no daemon): simplest, not automatic on
  machine-open. **We get C for free** — the same runbook is a manual command too.

```
You create an issue (agent_task template) ─► Project board: Todo  ◄── the trigger
                                                    │
        launchd LaunchAgent (RunAtLoad on login, KeepAlive)
                    │   token via plist EnvironmentVariables (NOT keychain)
                    ▼
   acdc-watch (cheap board scan every ACDC_POLL_SECONDS=300)
        • skips: not agent-ready, not Todo, needs-human/blocked, in-flight
        • enforces concurrency cap (1 thru Phase 3), usage guard, circuit breaker
        • posts a board "picked up by ACDC @ <t>" heartbeat within one tick
                    │
                    ▼
   claude -p  (headless, subscription token, explicit --settings, ANTHROPIC_API_KEY unset)
        records durable in-flight state: ~/.acdc/inflight/issue-N.{pid,started}
                    │
   git worktree ../bs-kara-wt/issue-N on run/issue-N off origin/main
   (fresh worktree => no untracked .env.local present)
        implement (TDD; red-before-green) → add Playwright e2e (video)
        → green bar = EXACTLY the ci.yml commands (pnpm/turbo)
        → Claude adversarial self-review → fix → re-green
        → commit (Conventional Commits, ≤100 cols, NO Claude attribution)
        → push → open PR (closes #N) → agent sets board: In review (explicit)
                    │
   gate wait via `gh pr checks --watch` (event-ish, bounded 20 min):
        CI (required) + SonarCloud + CodeRabbit
        → resolver pass for blocking findings (≤3 iterations)
        → re-check kill switch (~/.acdc/paused) before push and before merge
                    │
   merge decision (POSITIVE signals only):
     • ticket has `auto-merge` label AND branch protection enabled AND
       every REQUIRED check reports an explicit PASS AND no blocking finding AND
       zero dismissed-not-fixed findings
         → `gh pr merge --auto --merge`  (GitHub enforces gates server-side) → Done
     • otherwise → leave PR open in In review, stop  (you merge)
```

## Components

### 1. The board
A GitHub Project (v2) **"bs-kara Delivery"** with a `Status` single-select:
`Todo`, `In Progress`, `In review`, `Done`. **Transition ownership is explicit**
(built-in workflows do *not* move an item to a custom "In review" on PR-open):

| Transition | Owner |
|---|---|
| (item added) → Todo | board built-in "Item added to project" |
| Todo → In Progress | **agent** (`gh project item-edit`) at dispatch/claim |
| In Progress → In review | **agent** (`gh project item-edit`) right after PR open |
| → Done | **agent** on merge (do not rely on the merge/close built-in) |

### 2. Issue template & labels
- `.github/ISSUE_TEMPLATE/agent_task.yml` — Context, Acceptance criteria (testable
  checklist), Scope boundaries (what must NOT change), **Area** (dropdown), and a
  Proof-of-work checkbox. Applies `agent-ready`.
- `.github/ISSUE_TEMPLATE/config.yml` — disables blank issues.
- `.github/labels.json` — `agent-ready`, `needs-human`, `blocked`, `auto-merge`,
  `type:{feature,bug,chore,docs}`, `priority:{high,med,low}`, and the **Area
  labels, one-to-one with the dropdown** (single canonical list):
  **`area:web`, `area:mobile`, `area:shared`, `area:e2e`, `area:infra`,
  `area:multiple`**.
- `.github/PULL_REQUEST_TEMPLATE.md` — checklist incl. proof-of-work video link
  and the Rule-6 test-accountability block (see Testing).
- `.github/CODEOWNERS` — requires human review for any PR touching the automation's
  own controls: `.github/`, `.claude/`, `scripts/acdc/`, root `package.json` /
  `turbo.json`, `database.rules.json`, `bk-web/lib/firebase*`.

### 3. CI workflow — `.github/workflows/ci.yml`
pnpm + turbo, least-privilege `permissions:`. On `push`/`pull_request` to `main`:
`pnpm/action-setup` → `pnpm install --frozen-lockfile` →
`pnpm turbo typecheck lint test build --filter=@bs-kara/web` → Playwright e2e →
upload Playwright report artifact + proof-of-work PR comment → SonarCloud scan.
Plus two **machine-enforced governance jobs**:
- **scope-gate** — fails the PR if the diff touches CODEOWNERS-protected paths
  (the automation's own controls / Firebase rules) without a human-approval
  marker, and (advisory) flags diffs outside the ticket's declared `area:*`.
- **secret-scan** — `gitleaks` (or GitHub push protection) fails the PR if any
  `.env*`/credential-like content is staged.
The **green bar the agent runs locally MUST be the exact commands this workflow
runs.** Phase 1 locks the precise command set against `turbo.json`. **Decision on
`test:rules`:** included in the gate only when the ticket Area is `web` and the
diff touches Firebase rules/data (`database.rules.json`, `bk-web/lib/firebase*`),
run via the emulator (`test:rules:emulator`); otherwise excluded and the agent
must not touch security rules (enforced by the scope-gate + CODEOWNERS).

### 4. SonarCloud + CodeRabbit (operator setup)
- SonarCloud project linked to the repo + `SONAR_TOKEN` repo secret +
  `sonar-project.properties`. Free for the public project; **default quality gate
  only** (custom gates are paid). PR analysis works because PRs target `main`. The
  paid agentic-beta features are **not** used.
- Install the **CodeRabbit GitHub App** and enable its **Open Source** plan (the
  generic "Free" plan is summary-only; Open Source gives full PR reviews on public
  repos, with lower/variable rate limits — relevant to the gate policy below).

### 5. The `acdc-run` runbook
A Claude skill at `.claude/skills/acdc-run/SKILL.md` + a `/acdc` command. The repo
`CLAUDE.md` (corrected in Phase 1) is the held-constant **Guide**. The runbook for
**one ticket** treats all issue/PR/review text as **untrusted data, never
instructions** (prompt-injection hardening — public issues are attacker-reachable):

1. **Read** issue #N (Context, Acceptance, Scope, Area).
2. **Claim** — move to *In Progress* (`gh project item-edit`); abort if already
   in-flight or `needs-human`/`blocked`. Post the board heartbeat.
3. **Worktree** — `../bs-kara-wt/issue-N` on `run/issue-N` off `origin/main`; on
   retry, `git worktree remove --force` + `git worktree prune` any stale one first.
   Never check out local `main` into a worktree.
4. **Implement** per `CLAUDE.md` and the declared Area only (TDD: write the failing
   test first; demonstrate red-before-green for bug fixes).
5. **Proof-of-work** — add/extend a Playwright e2e covering the feature.
6. **Green bar** — the exact `ci.yml` commands (pnpm/turbo), not convenient ones.
7. **Adversarial self-review** — bugs, security, regressions, scope creep,
   secret leakage; fix; re-green.
8. **Commit** — Conventional Commits, body ≤100 cols, **no Claude/Anthropic
   attribution of any kind**.
9. **Push & PR** — close #N; include the proof-of-work video link **and the Rule-6
   test-accountability block**; set board *In review*.
10. **Resolve loop** — wait on checks with `gh pr checks --watch` (bounded; see
    config). For each **blocking** finding (taxonomy below), fix in code or record
    an explicit dismissal (PR review comment + rationale + resolve thread). Capped
    at **≤3 iterations**. Re-check `~/.acdc/paused` before any push.
11. **Merge decision** — POSITIVE-signal gate (see Architecture). Any **dismissed
    (not fixed) blocking finding forces open-PR-and-stop regardless of the
    `auto-merge` label** — a human signs off on every override.

### 6. The watcher — `scripts/acdc/` (TypeScript; thin I/O shell + pure core)
Every `ACDC_POLL_SECONDS`:
- Re-derives live state from GitHub (`gh project item-list`, `gh pr list`,
  `gh pr view`), never trusting stale memory.
- **Reconciliation on startup** (KeepAlive can restart it): for each board item in
  *In Progress*, check its recorded `~/.acdc/inflight/issue-N.pid`; if the process
  is dead, return the ticket to *Todo* (or `needs-human` after the attempt cap)
  and free the slot.
- Selects dispatchable tickets and enforces, in pure functions, the concurrency
  cap, the usage guard, the circuit breaker, and (Phase 4) hard non-overlap.
- Launches `claude -p` per ticket with the explicit permission posture; records
  durable in-flight state; applies a per-worker wall-clock budget (kill +
  return-to-Todo on timeout, e.g. across a sleep/wake).
- Honors `~/.acdc/paused`; posts a daily "watcher alive" heartbeat.

**Pure, unit-tested functions** (each with a defined signature over typed
ticket/PR shapes): `selectDispatchableTickets`, `isInFlight`, `mergeDecision`
(full truth table), `chooseNonOverlapping` (overlap computed from the `area:*`
label — file lists are unknown pre-run), `withinUsageWindow`, `nextBackoff`,
`classifyClaudeExit` (auth-expiry vs crash vs success), `pollSettled`,
`attemptCountExceeded`, `circuitBreakerTripped`.

### 7. launchd LaunchAgent
`~/Library/LaunchAgents/com.bason.acdc-watch.plist`, `RunAtLoad=true`,
`KeepAlive=true`, `StandardOutPath`/`StandardErrorPath` under `~/.acdc/`. **Auth is
injected via `EnvironmentVariables`, not the keychain** (see Auth & secrets).
Load with `launchctl bootstrap gui/$(id -u) <plist>` (GUI domain → keychain
unlocked, GUI access); unload with `launchctl bootout gui/$(id -u)/<label>`.
`scripts/acdc/install.sh` / `uninstall.sh` manage it.

## Auth & secret handling (was the weakest part of v1)

- **Claude auth, headless:** generate a long-lived token with `claude setup-token`
  and provide `CLAUDE_CODE_OAUTH_TOKEN` to the watcher via the plist
  `EnvironmentVariables` (or a `chmod 600` sourced file) — this draws on the
  subscription, needs no browser, and avoids the macOS keychain
  "user interaction is not allowed" failure that a launchd-spawned process hits.
  **Ensure `ANTHROPIC_API_KEY` is unset** in that environment (in `-p` mode an API
  key, if present, always takes precedence over the subscription). Token is
  inference-only and valid ~1 year; `--bare` mode is not used (it ignores it).
- **`gh` auth, headless:** provide `GH_TOKEN` via the same env path so `gh` does
  not depend on a keychain read in the launchd context. The token needs `project`
  (write — `read:project` is insufficient for `item-edit`), `workflow`, and `repo`.
- **Secrets blast radius:** the repo working tree holds `.env.local` with real
  secrets (OpenAI, Gemini, Google TTS, Firebase admin key, YouTube keys). Mitigations:
  - Worktrees are created off `origin/main`; `.env.local` is gitignored and
    untracked, so a fresh worktree does **not** contain it. **Never** copy it in.
  - The agent settings **deny** reads/writes of `.env*`, `~/.acdc/`, `~/.config/gh`,
    and any credential path (deny rules, not just an allow-list).
  - `secret-scan` CI job + GitHub push protection block any staged secret.
  - All ACDC runtime state (logs, `paused` flag, worktrees) lives **outside** the
    repo tree (`~/.acdc`, `../bs-kara-wt`) — a hard rule.

## Permissions model (must override the inherited global mode)

The global `~/.claude/settings.json` here sets `defaultMode: auto` +
`skipAutoPermissionPrompt: true`, so `--allowedTools` alone is a **no-op** —
everything auto-approves. Therefore the watcher launches `claude -p` with an
**explicit** posture it controls and **verifies it with a deny test** (attempt
`rm` outside the worktree → must be denied) before trusting any run:

- A dedicated `--settings .claude/acdc-settings.json` that does **not** inherit the
  repo's existing broad `.claude/settings.local.json` (which grants `curl *`,
  `git push *`, `node *` with no deny rules). Verify the **effective merged**
  permission set, since Claude Code merges enterprise/project/local layers.
- **Allow** (command-granular): specific `gh` subcommands only
  (`gh pr create/view/checks/merge`, `gh project item-list/item-edit`,
  `gh issue view/comment/edit`); `git` minus force-push; `pnpm install
  --frozen-lockfile` and named `pnpm/turbo` scripts; `playwright`; file edits
  within the worktree.
- **Deny:** `.env*` and credential paths; `gh secret`, `gh api` writes, `gh auth`,
  `gh workflow run`; `git push --force*`; `rm` outside the worktree; `curl`/`wget`
  to non-allowlisted hosts; arbitrary `npx <anything>`.
- **`--dangerously-skip-permissions` is forbidden** on the unattended/auto-merge
  path.

## Gate policy (mandatory vs. advisory)

- **Mandatory (block merge, auto or human):** GitHub CI required checks
  (`ci.yml`: typecheck, lint, test, build, e2e, scope-gate, secret-scan) **and**
  the Claude adversarial self-review.
- **Independent mandatory gate for auto-merge:** because the implementer and
  self-reviewer share a model family ("Claude-on-Claude" softness), the
  `auto-merge` path additionally requires **at least one independent gate
  (CodeRabbit *or* SonarCloud) to have actually completed with a PASS** —
  *absence* of findings from a throttled/queued free-tier reviewer does **not**
  count as a pass. If no independent gate completed in the bounded window,
  auto-merge falls back to **open-PR-and-stop**.
- **Blocking-finding taxonomy** (drives the resolve loop + `mergeDecision`):

  | Source | Blocking | Non-blocking |
  |---|---|---|
  | GitHub CI | any red required check | — |
  | SonarCloud | Blocker / Critical / Major on new code; any security hotspot | Minor / Info |
  | CodeRabbit | findings categorized bug / security / "potential issue" | nits / style / praise |

  A **dismissal** = a PR review comment with rationale + resolved thread; a
  dismissed-not-fixed blocking finding forces open-PR-and-stop.

## Governance, safety & circuit breakers

- **Branch protection on `main` is a HARD prerequisite for the auto-merge label
  path** (Phase 1/operator, not optional): required status checks = the `ci.yml`
  jobs, require branch up-to-date, no force-push/deletion. Auto-merge uses
  `gh pr merge --auto --merge` so **GitHub**, not the agent's poll loop, enforces
  the gate server-side (also closes the read-then-merge race). Repo auto-merge
  must be enabled (admin available).
- **Kill switch with in-flight semantics:** `~/.acdc/paused` halts new dispatch
  *and* every in-flight run re-checks it before push and before merge and aborts if
  set. A `scripts/acdc/stop.sh` SIGTERMs tracked in-flight PIDs (hard stop). A
  remote kill is honored too: a `paused` board state / repo label the watcher reads
  (so it works when away from the Mac). Pause does **not** un-merge.
- **Global circuit breaker** (independent of per-ticket caps): max auto-merges per
  window, max dispatches per day, and an **auto full-pause + notify** when any
  threshold trips or the same issue is dispatched more than `ACDC_MAX_ATTEMPTS`
  times (poison-pill guard).
- **Usage guard:** dispatch is bounded by `ACDC_MAX_TICKETS_PER_WINDOW` over the
  subscription window; **reserve headroom for the human's own Claude usage on the
  same login** (optional quiet-hours + a daily cap). A usage-window hit is treated
  like auth-expiry (pause + notify), not silently chewed by backoff.
- **Scope enforcement is machine-gated** (CI scope-gate + CODEOWNERS), not
  self-policed only.
- **No Claude attribution in commits** — hard-enforced in the runbook.
- **Human-attention annunciation is board-visible**, not just a local log +
  `osascript` notification: the agent comments/labels the issue (`needs-human`)
  so a stalled queue is observable without shell access to the Mac.

## Error handling

| Failure | Handling |
|---|---|
| Headless run crashes / non-zero exit | Watcher logs, reconciles via PID file, returns ticket to *Todo*; `needs-human` after `ACDC_MAX_ATTEMPTS` |
| Green bar fails after retries | Agent stops, comments, labels `needs-human` |
| Findings unresolved after ≤3 passes | Stop, `needs-human`, leave PR open |
| Slow/queued free-tier reviewer | Bounded `--watch`; for auto-merge, missing independent PASS → open-PR-and-stop (never merge on absence) |
| Merge conflict on a behind branch | Sync pass (`git merge origin/main` → resolve → re-green → push); human-undecidable → `needs-human` |
| Mac sleeps mid-run | Per-worker wall-clock budget kills + returns to *Todo*; gh polls retry/backoff on transport errors |
| `claude` auth expired / usage-window hit | `classifyClaudeExit` detects it → global pause + board-visible notice |
| Watcher restarted by KeepAlive | Startup reconciliation from PID files (no orphans counted as forever-in-flight) |

## Testing strategy (per bs-kara's strict `CLAUDE.md` Rules 1–6)

- **Watcher (`scripts/acdc/`)** — Vitest unit tests for **every** pure function
  listed in Component 6 and **every non-trivial branch**: dispatch filters, the
  `mergeDecision` truth table (label × branch-protection × required-PASS ×
  independent-PASS × blocking × dismissed), usage-window math, backoff schedule,
  kill-switch gate, in-flight retry/escalation counter, `classifyClaudeExit`,
  poll-`settled`, circuit-breaker thresholds, `chooseNonOverlapping`.
- **CI workflow (high-risk infra, Rule 3)** — wire `actionlint` + YAML-schema check
  into the suite; add a Vitest test for any script generating the proof-of-work PR
  comment. Not "green once" only.
- **Proof-of-work is machine-checkable, not just a video:** the PR diff MUST
  include a new/changed test in the touched Area, and the runbook demonstrates
  red-before-green; a run that produced no meaningful test is routed to
  `needs-human`, not merged. The Rule-6 accountability block is required in the PR.
- **App-feature e2e** is produced by each agent run; the independent gates
  (CodeRabbit/Sonar) carry the assertion-quality check that same-model review can't.
- **`test:rules`** scope decided in Component 3.

## Concrete configuration (no placeholders)

All in `~/.acdc/config` (env-overridable); defaults:

| Key | Default | Meaning |
|---|---|---|
| `ACDC_POLL_SECONDS` | 300 | board scan cadence (bounds 60–1800) |
| `ACDC_MAX_CONCURRENT` | 1 | in-flight tickets (Phase 4 may raise to ≤3) |
| `ACDC_WORKER_TIMEOUT_MIN` | 45 | per-`claude -p` wall-clock budget |
| `ACDC_RESOLVE_MAX_ITERS` | 3 | resolve-loop cap |
| `ACDC_CHECKS_WATCH_TIMEOUT_MIN` | 20 | bounded gate wait |
| `ACDC_MAX_TICKETS_PER_WINDOW` | 4 | usage guard per ~5h subscription window |
| `ACDC_MAX_DISPATCHES_PER_DAY` | 12 | daily dispatch ceiling |
| `ACDC_MAX_AUTOMERGES_PER_WINDOW` | 3 | circuit breaker |
| `ACDC_MAX_ATTEMPTS` | 2 | per-ticket retries before `needs-human` |

## Phasing (each phase = its own branch off a clean tree, never `main`)

- **Phase 0 — Prerequisites (operator; gates the rest):**
  - `gh auth refresh -s project,workflow` (adds Projects write + workflow push).
  - **Billing gate:** run one real ticket and confirm via the account usage
    dashboard that `-p` drew on the subscription (constraint #1). Verify
    `ANTHROPIC_API_KEY` is unset for the agent env.
  - **launchd auth gate:** install a throwaway LaunchAgent that runs
    `claude -p 'echo ok' --output-format json` with `CLAUDE_CODE_OAUTH_TOKEN`,
    `launchctl bootstrap gui/$(id -u)`, log out/in, confirm success with **no**
    interactive unlock. (A Terminal dry run does not prove this.)
  - **permission gate:** confirm the explicit `--settings` posture denies `rm`/`.env`
    in headless mode (deny test).
  - Create the board + `Status` field; enable repo auto-merge; **add branch
    protection on `main`** requiring the CI checks.
  - Install CodeRabbit (Open Source plan); create SonarCloud project + `SONAR_TOKEN`.
- **Phase 1 — Repo scaffolding (PR):** labels, `agent_task` template + config, PR
  template, CODEOWNERS, `ci.yml` (incl. scope-gate + secret-scan), `actionlint`
  wiring, `sonar-project.properties`, and **the corrected `CLAUDE.md`** (pnpm/turbo
  commands + ACDC run conventions: worktree path, scoped-permission expectation,
  board-status command snippets).
- **Phase 2 — `acdc-run` runbook + `/acdc`:** prove end-to-end on **one real
  `bk-web` ticket**, kicked off manually, serial (cap 1), open-PR-and-stop.
- **Phase 3 — Watcher + launchd:** unit-tested decision logic, the watcher shell,
  durable in-flight tracking + reconciliation, kill switch, plist, install/uninstall,
  logging, heartbeat. Prove it auto-dispatches one ticket after login. Cap stays 1.
- **Phase 4 (later):** raise the pool to ≤3 with **hard** non-overlap enforcement,
  conflict-recovery hardening, and (optionally) migrate the trigger to the
  event-driven self-hosted-runner (Approach B).

## Risks & open items

1. **Billing (existential):** `-p` may meter against API billing (see caveat +
   Phase-0 gate). If so, the "free" promise fails.
2. **launchd ⇄ keychain:** mitigated by `CLAUDE_CODE_OAUTH_TOKEN`/`GH_TOKEN` in the
   plist env; still must pass the Phase-0 launchd auth gate.
3. **Single-machine fragility:** works only while this Mac is awake and logged in;
   a ticket can sit in Todo with the only failure signal being board-visible
   heartbeat/labels. Documented as a first-class limitation (Success criteria).
4. **Free-tier reviewer bursts:** independent gate may be throttled; the gate
   policy degrades auto-merge to open-PR-and-stop rather than merging on absence.
5. **Claude-on-Claude review softness:** offset by the *mandatory independent gate*
   for auto-merge and machine-checkable proof-of-work.

## Out of scope (YAGNI)

Multi-repo orchestration; a hosted "ACDC product"; paid reviewers/tiers; an
Anthropic API key or `claude-code-action`; non-macOS trigger runtimes.

## Success criteria

The project succeeds when, **with the Mac awake and logged in** (an accepted
limitation):
- Opening an `agent-ready` ticket in *Todo* results — with **no further human
  action** — in a green PR that closes the issue, carrying a machine-verified
  Playwright proof-of-work, with the board advanced to *In review* (or *Done* if
  `auto-merge` and all hard safety prerequisites + positive gate signals hold),
  **and**
- the Phase-0 billing gate has confirmed every step ran on the local subscription
  and free GitHub / free-tier services only — no API key and no paid service.

---

## Appendix A — the three brainstorm-confirmed decisions (recap)

Target = `bs-kara`; board = GitHub Projects v2; trigger = launchd-on-login →
headless `claude -p`; gates = all free GitHub gates + Claude self-review; merge =
auto-merge only if `auto-merge`-labelled.

## Appendix B — verified external facts (2026-06-20 fact-check)

1. **Headless subscription auth:** `claude -p` works on a Pro/Max/Team/Enterprise
   subscription with no `ANTHROPIC_API_KEY`, but for unattended launchd use
   `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` (avoids keychain
   non-interactivity); ensure no API key is present (it takes precedence in `-p`).
   Known billing bug #43333 — verify via dashboard.
2. **GitHub Actions:** unlimited free minutes on public repos (confirmed, 2026).
3. **SonarCloud:** free for public projects, unlimited LOC, default gate + PR
   analysis when the target is `main`; custom gates + non-main branch analysis are
   paid; agentic-beta is paid.
4. **CodeRabbit:** free PR reviews on public repos via the **Open Source** plan
   (not the generic "Free" plan, which is summary-only); lower/variable rate limits.
5. **launchd:** `RunAtLoad`+`KeepAlive` behave as assumed; load into
   `gui/<uid>` for the unlocked-keychain/GUI session; user must be logged in.
6. **gh scopes:** `project` (write) needed for `item-edit` (`read:project` is
   read-only); `workflow` for workflow files; `repo` for the push.
7. **Projects v2:** CLI `item-list`/`item-edit` work; built-ins auto-set Done on
   merge/close but there is **no** built-in "In review on PR open" — the agent must
   set it explicitly.

## Appendix C — resolved review findings (summary)

Four blockers resolved in v2: (a) auto-merge → branch protection prerequisite +
`gh pr merge --auto` + positive-signal gate policy + dismissed-finding stop;
(b) secret exfiltration → deny rules, worktree-without-`.env`, untrusted-input
hardening, secret-scan + push protection; (c) launchd keychain → token-via-plist
env + Phase-0 launchd auth gate; (d) permission no-op → explicit `--settings` +
deny test, forbid `--dangerously-skip-permissions`. Majors resolved: pnpm/turbo
monorepo commands + stale `CLAUDE.md` fix; cap=1 through Phase 3; quantified config
(no placeholders); blocking-finding taxonomy; durable in-flight tracking +
reconciliation; per-worker wall-clock budget; in-flight kill-switch + circuit
breaker; machine-gated scope + CODEOWNERS; expanded Vitest coverage + actionlint +
machine-checkable proof-of-work; board-visible heartbeat; event-ish gate waiting
(`gh pr checks --watch`); Approach B reconsidered sooner.
