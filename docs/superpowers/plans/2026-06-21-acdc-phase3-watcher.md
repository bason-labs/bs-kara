# ACDC Phase 3 — launchd Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.
> **Prerequisite:** Phase 2 must be merged to `main` (the `acdc-run` runbook + `@bs-kara/acdc` helpers — `decideMerge`, `board`, `greenBar`, `parseAgentTaskIssue` — are imported by the watcher). Also: the `project` gh scope + the "bs-kara Delivery" board (`~/.acdc/board.env`), a rotated `CLAUDE_CODE_OAUTH_TOKEN` in `~/.acdc/claude-token.env`, and the `NEXT_PUBLIC_FIREBASE_*` values available to export (the headless e2e build needs them — the proof run confirmed `next build` dies without them and the scoped settings deny reading `.env.local`).

**Goal:** A macOS launchd watcher that, while you're logged in, polls the board and dispatches the proven `acdc-run` runbook (headless `claude -p`, your subscription) for each `agent-ready` ticket — serial (cap 1) — with durable in-flight tracking, a kill switch, a usage guard, and a circuit breaker. Prove it auto-dispatches one ticket after login.

**Architecture:** Pure, unit-tested decision logic in `@bs-kara/acdc` (`scripts/acdc/src/watcher/`) + a thin I/O shell (`bin/acdc-watch.ts`) that re-derives state from `gh`, reconciles durable PID files, and spawns one `claude -p` per dispatchable ticket with the correct environment (token, `NEXT_PUBLIC_FIREBASE_*`, `ANTHROPIC_API_KEY` unset, `--settings .claude/acdc-settings.json`). A launchd LaunchAgent (`RunAtLoad`+`KeepAlive`) runs the shell on login; install/uninstall scripts manage it.

**Tech Stack:** TypeScript (strict) + Vitest + `tsx`; macOS launchd; `gh` CLI; the Phase-2 `acdc-run` runbook.

**Source spec:** `docs/superpowers/specs/2026-06-20-acdc-automation-design.md` (Components 6–7, Governance, Config).

## Branch & rules
Branch `feat/acdc-phase3-watcher` off `main` (after Phase 2 merged). Conventional Commits, **no Claude/Anthropic attribution**. Touches `scripts/acdc/` (protected → needs `human-approved` label on the PR).

## Config (`~/.acdc/config`, env-overridable) — concrete defaults
| Key | Default | Meaning |
|---|---|---|
| `ACDC_POLL_SECONDS` | 300 | board scan cadence (60–1800) |
| `ACDC_MAX_CONCURRENT` | 1 | in-flight tickets (Phase 4 may raise to ≤3) |
| `ACDC_WORKER_TIMEOUT_MIN` | 45 | per-`claude -p` wall-clock budget |
| `ACDC_MAX_TICKETS_PER_WINDOW` | 4 | usage guard per ~5h window |
| `ACDC_MAX_DISPATCHES_PER_DAY` | 12 | daily ceiling |
| `ACDC_MAX_AUTOMERGES_PER_WINDOW` | 3 | circuit breaker |
| `ACDC_MAX_ATTEMPTS` | 2 | per-ticket retries before `needs-human` |

---

### Task 3.1: Dispatch selection (TDD)

**Files:** Create `scripts/acdc/src/watcher/select.ts` (+ test)

- [ ] **Step 1: Failing test** — `scripts/acdc/src/watcher/select.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { selectDispatchable, type Ticket } from './select';

const t = (n: number, labels: string[], status: string): Ticket => ({ number: n, labels, status });

describe('selectDispatchable', () => {
  const tickets = [
    t(1, ['agent-ready'], 'Todo'),
    t(2, ['agent-ready', 'needs-human'], 'Todo'),
    t(3, ['agent-ready', 'blocked'], 'Todo'),
    t(4, ['agent-ready'], 'In Progress'),
    t(5, [], 'Todo'),
    t(6, ['agent-ready'], 'Todo'),
  ];
  it('picks only agent-ready, Todo, not needs-human/blocked, not in-flight', () => {
    const out = selectDispatchable(tickets, new Set([6]), 5);
    expect(out.map((x) => x.number)).toEqual([1]);
  });
  it('respects the concurrency cap given current in-flight count', () => {
    const free = selectDispatchable([t(1, ['agent-ready'], 'Todo'), t(7, ['agent-ready'], 'Todo')], new Set(), 1);
    expect(free).toHaveLength(1);
  });
  it('returns nothing when the cap is already full', () => {
    expect(selectDispatchable(tickets, new Set([99]), 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail.** **Step 3: Implement** — `scripts/acdc/src/watcher/select.ts`

```ts
export interface Ticket { number: number; labels: string[]; status: string }

export function selectDispatchable(tickets: Ticket[], inFlight: Set<number>, cap: number): Ticket[] {
  const slots = Math.max(0, cap - inFlight.size);
  if (slots === 0) return [];
  return tickets
    .filter((t) =>
      t.status === 'Todo' &&
      t.labels.includes('agent-ready') &&
      !t.labels.includes('needs-human') &&
      !t.labels.includes('blocked') &&
      !inFlight.has(t.number))
    .slice(0, slots);
}
```

- [ ] **Step 4: Run → pass. Step 5: Commit** `feat(acdc): watcher dispatch selection`

---

### Task 3.2: Usage guard, circuit breaker, backoff (TDD)

**Files:** Create `scripts/acdc/src/watcher/guards.ts` (+ test)

- [ ] **Step 1: Failing test** — `scripts/acdc/src/watcher/guards.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { withinLimits, nextBackoffMs, circuitTripped, type GuardState, type Limits } from './guards';

const limits: Limits = { maxPerWindow: 4, maxPerDay: 12, maxAutoMergesPerWindow: 3, maxAttempts: 2 };

describe('guards', () => {
  it('allows dispatch under the window + day limits', () => {
    const s: GuardState = { dispatchesThisWindow: 1, dispatchesToday: 2, autoMergesThisWindow: 0 };
    expect(withinLimits(s, limits).ok).toBe(true);
  });
  it('blocks at the per-window cap', () => {
    expect(withinLimits({ dispatchesThisWindow: 4, dispatchesToday: 5, autoMergesThisWindow: 0 }, limits).ok).toBe(false);
  });
  it('blocks at the daily ceiling', () => {
    expect(withinLimits({ dispatchesThisWindow: 0, dispatchesToday: 12, autoMergesThisWindow: 0 }, limits).ok).toBe(false);
  });
  it('circuitTripped when auto-merges exceed the window cap', () => {
    expect(circuitTripped({ dispatchesThisWindow: 0, dispatchesToday: 0, autoMergesThisWindow: 3 }, limits)).toBe(true);
  });
  it('backoff grows exponentially and is capped', () => {
    expect(nextBackoffMs(0)).toBe(1000);
    expect(nextBackoffMs(3)).toBe(8000);
    expect(nextBackoffMs(20)).toBeLessThanOrEqual(300000);
  });
});
```

- [ ] **Step 2-3: Implement** — `scripts/acdc/src/watcher/guards.ts`

```ts
export interface Limits { maxPerWindow: number; maxPerDay: number; maxAutoMergesPerWindow: number; maxAttempts: number }
export interface GuardState { dispatchesThisWindow: number; dispatchesToday: number; autoMergesThisWindow: number }

export function withinLimits(s: GuardState, l: Limits): { ok: boolean; reason: string } {
  if (s.dispatchesThisWindow >= l.maxPerWindow) return { ok: false, reason: 'per-window dispatch cap reached' };
  if (s.dispatchesToday >= l.maxPerDay) return { ok: false, reason: 'daily dispatch ceiling reached' };
  return { ok: true, reason: '' };
}
export function circuitTripped(s: GuardState, l: Limits): boolean {
  return s.autoMergesThisWindow >= l.maxAutoMergesPerWindow;
}
export function nextBackoffMs(consecutiveFailures: number): number {
  return Math.min(300_000, 1000 * 2 ** consecutiveFailures);
}
```

- [ ] **Step 4-5: Run → pass; commit** `feat(acdc): watcher usage guard, circuit breaker, backoff`

---

### Task 3.3: Claude-exit classification + in-flight reconciliation (TDD)

**Files:** Create `scripts/acdc/src/watcher/runState.ts` (+ test)

- [ ] **Step 1: Failing test** — `scripts/acdc/src/watcher/runState.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { classifyExit, reconcile, type InFlightRecord } from './runState';

describe('classifyExit', () => {
  it('detects auth/credential failure', () => {
    expect(classifyExit(1, 'Invalid API key / OAuth token expired').kind).toBe('auth');
    expect(classifyExit(1, 'user interaction is not allowed').kind).toBe('auth');
  });
  it('detects success vs generic crash', () => {
    expect(classifyExit(0, '').kind).toBe('success');
    expect(classifyExit(1, 'TypeError: x').kind).toBe('crash');
  });
});

describe('reconcile', () => {
  const alive = (pid: number) => pid === 111; // injected liveness check
  it('returns issues whose recorded PID is dead back to Todo', () => {
    const recs: InFlightRecord[] = [
      { issue: 1, pid: 111, startedAt: 0 },
      { issue: 2, pid: 222, startedAt: 0 },
    ];
    const r = reconcile(recs, alive);
    expect(r.alive.map((x) => x.issue)).toEqual([1]);
    expect(r.dead.map((x) => x.issue)).toEqual([2]);
  });
});
```

- [ ] **Step 2-3: Implement** — `scripts/acdc/src/watcher/runState.ts`

```ts
export interface InFlightRecord { issue: number; pid: number; startedAt: number }
export type ExitKind = 'success' | 'auth' | 'crash';

const AUTH_PATTERNS = [/oauth token expired/i, /invalid api key/i, /user interaction is not allowed/i, /unauthor/i, /login/i];

export function classifyExit(code: number, stderr: string): { kind: ExitKind } {
  if (code === 0) return { kind: 'success' };
  if (AUTH_PATTERNS.some((re) => re.test(stderr))) return { kind: 'auth' };
  return { kind: 'crash' };
}

export function reconcile(records: InFlightRecord[], isAlive: (pid: number) => boolean) {
  const alive = records.filter((r) => isAlive(r.pid));
  const dead = records.filter((r) => !isAlive(r.pid));
  return { alive, dead };
}
```

- [ ] **Step 4-5: Run → pass; commit** `feat(acdc): watcher exit classification and in-flight reconciliation`

---

### Task 3.4: Kill switch + config loader (TDD)

**Files:** Create `scripts/acdc/src/watcher/config.ts` (+ test)

- [ ] **Step 1-3:** `loadConfig(env)` returns the Config table defaults with env overrides + bounds-clamping for `ACDC_POLL_SECONDS` (60–1800); `isPaused(fs, path)` returns true if `~/.acdc/paused` exists. Test: defaults; an override; clamping; paused true/false. (Inject `fs.existsSync` for testability.)

- [ ] **Step 4-5: Commit** `feat(acdc): watcher config loader and kill-switch check`

---

### Task 3.5: The watcher shell

**Files:** Create `scripts/acdc/bin/acdc-watch.ts`

- [ ] **Step 1: Implement the loop** (thin I/O over the tested pure functions). Each tick:
  1. If `isPaused()` → log + sleep `ACDC_POLL_SECONDS`, continue.
  2. **Reconcile:** read `~/.acdc/inflight/issue-*.json`; `reconcile` against live PIDs; for dead records whose board item is still *In Progress*, return the ticket to *Todo* (or `needs-human` after `ACDC_MAX_ATTEMPTS`) and remove the record.
  3. **Re-derive state from GitHub:** `gh project item-list` (board) + `gh pr list`. Build the `Ticket[]` and the in-flight set.
  4. **Guards:** if `circuitTripped` → write `~/.acdc/paused` + notify (`osascript -e 'display notification …'`) + log; stop dispatching. If `!withinLimits` → skip this tick.
  5. **Select:** `selectDispatchable(tickets, inFlight, cfg.maxConcurrent)`.
  6. **Dispatch** each selected ticket: move board → *In Progress*; spawn
     ```
     env -u ANTHROPIC_API_KEY \
       CLAUDE_CODE_OAUTH_TOKEN=<from ~/.acdc/claude-token.env> \
       NEXT_PUBLIC_FIREBASE_API_KEY=… (all 5, from ~/.acdc/firebase.env) \
       claude -p "<acdc-run prompt for issue N>" --settings .claude/acdc-settings.json --output-format json
     ```
     in the repo; write `~/.acdc/inflight/issue-N.json` (`{issue, pid, startedAt}`); post a board "picked up by ACDC" heartbeat comment.
  7. On a worker finishing: `classifyExit`; on `auth` → write `~/.acdc/paused` + notify; on `crash` → bump attempt count, return to Todo or `needs-human`; on `success` → clear the record (the runbook already opened/merged the PR).
  8. Enforce `ACDC_WORKER_TIMEOUT_MIN` (kill + return-to-Todo on overrun, e.g. across sleep/wake).
  9. Daily heartbeat log line.

- [ ] **Step 2: Commit** `feat(acdc): launchd watcher shell`

> The `NEXT_PUBLIC_FIREBASE_*` are sourced from `~/.acdc/firebase.env` (operator-created from the public client config) — NOT read from `.env.local` (scoped settings deny it). This is the proof-run learning.

---

### Task 3.6: launchd LaunchAgent + install/uninstall

**Files:** Create `scripts/acdc/launchd/com.bason.acdc-watch.plist.template`, `scripts/acdc/launchd/install.sh`, `scripts/acdc/launchd/uninstall.sh`

- [ ] **Step 1: plist template** — `Label` `com.bason.acdc-watch`, `ProgramArguments` = a wrapper that `cd`s to the repo and runs `pnpm -C scripts/acdc exec tsx bin/acdc-watch.ts`, `RunAtLoad=true`, `KeepAlive=true`, `EnvironmentVariables` carrying `CLAUDE_CODE_OAUTH_TOKEN` + `NEXT_PUBLIC_FIREBASE_*` (or have the wrapper source `~/.acdc/*.env`), `StandardOutPath`/`StandardErrorPath` = `~/.acdc/watch.log`.
- [ ] **Step 2: `install.sh`** — render the template (substitute `$HOME`, repo path), write to `~/Library/LaunchAgents/com.bason.acdc-watch.plist`, `launchctl bootout gui/$(id -u)/com.bason.acdc-watch 2>/dev/null; launchctl bootstrap gui/$(id -u) <plist>`. `uninstall.sh` boots it out + removes the plist.
- [ ] **Step 3: Commit** `feat(acdc): launchd LaunchAgent + install/uninstall scripts`

---

### Task 3.7: Prove it (the Phase-3 gate)

- [ ] **Step 1:** Operator prerequisites present: board (`~/.acdc/board.env`), token (`~/.acdc/claude-token.env`), `~/.acdc/firebase.env`.
- [ ] **Step 2:** Create a small `agent-ready` ticket in *Todo*. `bash scripts/acdc/launchd/install.sh`. Log out and back in (or `launchctl kickstart -k gui/$(id -u)/com.bason.acdc-watch`).
- [ ] **Step 3: Verify** the watcher picked it up within one poll: board → *In Progress*, a worker `claude -p` ran, and a green PR appeared (per the runbook) — with **no manual action**. Check `~/.acdc/watch.log`.
- [ ] **Step 4:** Test the kill switch (`touch ~/.acdc/paused` halts new dispatch) and reconciliation (kill a worker mid-run → next tick returns the ticket to Todo). `uninstall.sh` to stop.

---

## Self-Review
- **Spec coverage:** selection/guards/circuit-breaker/reconciliation/exit-classification/config/kill-switch → 3.1–3.4; watcher shell with env-export + heartbeat → 3.5; launchd + install → 3.6; prove-on-login → 3.7. ✅
- **Placeholders:** decision-logic code complete; the shell (3.5) is I/O glue described step-by-step (build against the tested pure functions). ✅
- **Deferred to Phase 4:** `ACDC_MAX_CONCURRENT` > 1 with hard non-overlap; conflict-recovery sync subagents; optional event-driven (Approach B) self-hosted-runner trigger.
