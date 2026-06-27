# ACDC Tiers + Safe Parallel Dispatch — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm) — pending spec review
**Author:** huynhthienba4@gmail.com
**Subject repo:** `github.com/bason-labs/bs-kara` (the `@bs-kara/acdc` workspace)
**Phase:** 1 of 2 (Phase 2 — a decompose/coordinator layer — is sketched, not built here)

## Purpose

Bring two of gradion-workspace's **swarm** orchestration ideas into bs-kara's
**ACDC** automation, without changing ACDC's safety model or its issue→PR→watcher-merge
output shape:

1. **Capability tiers** — route each dispatched worker to the right Claude model
   (`haiku`/`sonnet`/`opus`) by ticket difficulty, instead of always running the
   default model.
2. **Safe cross-ticket parallelism** — let the watcher run several `agent-ready`
   tickets concurrently (it already supports a concurrency cap, defaulted to 1),
   after fixing a dispatch-cap-overflow bug that currently makes raising the cap
   unsafe.

Plus one ergonomics requirement: the capability must be **callable directly from a
chat session here**, not only by the launchd daemon — mirroring how gradion's swarm
is triggerable both autonomously and via `Swarm handle <spec>`.

## Background — swarm vs ACDC (why this shape)

The **swarm** (gradion) and **ACDC** (bs-kara) are two independent automation
systems, one per repo; neither references the other. They share DNA (worktree
isolation, headless agent dispatch, a green/CI gate, proposer-not-merger discipline,
scope guards, untrusted-input handling, no-attribution commits, human-owns-merge)
but differ in shape:

| | ACDC (bs-kara) | Swarm (gradion) |
|---|---|---|
| Trigger | GitHub issue `agent-ready` (ticket-driven) | approved spec file (spec-driven) |
| Orchestrator | launchd **watcher daemon** | **coordinator agent** per spec |
| Implementers | claude only (subscription OAuth) | codex + claude, ordered policy, tiers |
| Parallelism | cross-ticket (cap, default 1) | within-feature fan-out + cross-spec fleet |
| Output | a **PR** per ticket | pushed branch + ledger doc (no PR) |
| Merge | watcher, gated on human `auto-merge` label | human, on the pushed branch |

"Apply the swarm to bs-kara" therefore means **grafting the swarm's orchestration
(tiers + parallel; later decompose) onto ACDC** — bs-kara does not gain a second
system. This spec ports the two capabilities that ACDC lacks and that don't fight
its merge model. Multi-vendor (codex) is **explicitly out** for Phase 1 (no codex
auth on the machine); the implementer abstraction is kept vendor-neutral so codex
can slot in later.

## Goals

- A pure tier-resolution module with precedence **inline arg → `tier:*` issue label
  → default (`medium`/sonnet)**.
- The resolved model is passed to the worker via `claude -p --model <model>` (today
  no `--model` is passed, so tiers are currently a no-op).
- The watcher can run `ACDC_MAX_CONCURRENT > 1` **without** exceeding the per-window
  / per-day dispatch caps in a single tick.
- A **direct, manual dispatch** entry point usable from a chat session here, reusing
  the watcher's exact dispatch path (worktree + scoped settings + inflight tracking)
  at the chosen tier.
- `tier:low|medium|high` labels exist in the repo label set for the watcher path.

## Non-goals (Phase 1)

- **No codex / second vendor.** Claude-only.
- **No change to the merge model.** Workers remain proposers that open a PR; the
  watcher remains the sole merge authority gated on a human `auto-merge` label.
- **No within-feature decomposition / coordinator.** That is Phase 2.
- **No change to scope-gate, green-bar, no-attribution, untrusted-input, or
  crash/timeout recovery.**

## Architecture

Phase 1 is additive to the existing `@bs-kara/acdc` workspace. New/changed units,
each small and independently testable:

### New: `scripts/acdc/src/tiers.ts` (pure)

```ts
export type Tier = 'low' | 'medium' | 'high';
export const TIER_MODEL: Record<Tier, string>;        // default low→haiku, medium→sonnet, high→opus
export function resolveTier(
  inline: string | undefined,                          // e.g. from /acdc 42 tier=high or dispatch-one arg
  labels: string[] | undefined,                        // ticket labels (watcher path)
  def?: Tier,                                           // default 'medium'
): Tier;                                                // inline > label(tier:*) > def
export function modelForTier(tier: Tier, env?: NodeJS.ProcessEnv): string; // env overrides allow full ids
```

- `resolveTier` is total: an unknown inline/label value is ignored (falls through),
  never throws. Only `low|medium|high` are honored.
- `modelForTier` reads optional env overrides `ACDC_TIER_LOW|MEDIUM|HIGH` so model
  aliases can be pinned to full ids without code changes (and so a Phase-2 codex tier
  map can reuse the same shape).

### Changed: `scripts/acdc/src/watcher/dispatch.ts` (pure)

`claudeArgs(prompt, settingsPath, model?)` appends `--model <model>` **only when
`model` is set**. `acdcRunPrompt` and `buildDispatchEnv` are unchanged. This is the
single change that makes tiers take effect.

### New: `scripts/acdc/src/watcher/budget.ts` (pure) — the concurrency-safety fix

```ts
export function dispatchBudget(
  state: GuardState,                                    // dispatchesThisWindow/Today
  limits: Limits,                                       // maxPerWindow / maxPerDay
  concurrencySlots: number,                             // cap - inFlight.size (from selectDispatchable)
): number;                                              // = max(0, min(slots, windowLeft, dayLeft))
```

The watcher currently checks `withinLimits` **once before** the dispatch loop and
then dispatches every pick while bumping counters per-iteration — so at
`maxConcurrent > 1` a single tick can overshoot `maxPerWindow`/`maxPerDay`.
`dispatchBudget` clamps the number of picks actually dispatched to the remaining
window/day budget; the watcher slices `picks` to it.

### New: `scripts/acdc/bin/dispatch-one.ts` (I/O shell) — the direct entry point

`tsx bin/dispatch-one.ts <issue> [tier]`:

1. Resolve tier = `resolveTier(tierArg, <issue labels via gh>, default)`.
2. Spawn the **same** headless worker the watcher does
   (`spawn('claude', claudeArgs(acdcRunPrompt(issue), SETTINGS_PATH, modelForTier(tier)), { env: buildDispatchEnv(...) })`),
   in its own worktree, writing the same `~/.acdc/inflight/issue-<n>.json` record so
   the watcher reconciles/merges it normally.
3. Print the dispatched issue, resolved tier+model, and pid; exit 0 on spawn.

This is the bs-kara analogue of `bin/swarm dispatch` being directly callable. It
reuses, not duplicates, the watcher's dispatch helpers. (To avoid duplicating the
spawn/env/inflight glue that currently lives inline in `acdc-watch.ts`, that glue is
extracted into a small shared helper both the watcher loop and `dispatch-one` call.)

### Changed: `scripts/acdc/src/watcher/config.ts`

Add `defaultTier: Tier` (env `ACDC_DEFAULT_TIER`, default `medium`). `maxConcurrent`
already exists (current default **1**); raise its default to a conservative **2**,
documented as needing live validation against subscription concurrency limits before
going higher. Tuning stays env-driven via `ACDC_MAX_CONCURRENT`.

### Changed: labels (`scripts/acdc/src/labels.ts` + the `labels.json` it parses + `bin/sync-labels.ts`)

Add `TIER_LABEL_NAMES = ['tier:low','tier:medium','tier:high']` (alongside the
existing `AREA_LABEL_NAMES`) and the matching entries in the `labels.json` consumed
by `parseLabels`/`sync-labels`, so the watcher path has labels to read. Exact
`labels.json` path is confirmed at implementation time.

### Changed: `.claude/commands/acdc.md`

Parse `tier=<low|medium|high>` from `$ARGUMENTS`. Document the honest semantics:
`/acdc 42` runs the runbook **in the current session** (model = your session model;
`tier=` is informational there); to dispatch a **headless** worker at a specific
tier, it shells out to `bin/dispatch-one.ts 42 <tier>`.

## Data flow

**Watcher path (unchanged except the two hooks):**
```text
poll board → reconcile inflight → merge step → withinLimits gate
  → selectDispatchable(cap) → slots = cap - inFlight
  → n = dispatchBudget(counters, limits, slots)          # NEW: clamp to window/day budget
  → for each of picks.slice(0, n):
       tier  = resolveTier(undefined, ticket.labels, defaultTier)   # NEW
       model = modelForTier(tier)                                   # NEW
       spawn claude -p --model <model> … (scoped settings, scrubbed env)  # --model NEW
       write inflight; bump counters
```

**Direct path (new):**
```text
you (chat) → tsx bin/dispatch-one.ts 42 high
  → tier=high (inline) → model=opus
  → same spawn + worktree + inflight as the watcher
  → watcher later reconciles, syncs board, and (if auto-merge) merges the PR
```

## Error handling

- `resolveTier` never throws; unknown values fall through to the default. A
  malformed `tier=` arg therefore degrades to `medium`, never crashes a dispatch.
- `dispatchBudget` returns 0 when no budget remains → the watcher dispatches nothing
  that tick (existing "nothing to dispatch" path), no overshoot.
- `dispatch-one` fails closed: missing token/firebase env (same checks as the
  watcher) → print reason, non-zero exit, no spawn, no inflight record.
- Concurrent subscription sessions hitting a rate limit currently classify as
  `crash` → ticket returns to Todo → retried (bounded by `maxAttempts`). **Risk:**
  this can thrash at higher caps; if observed, add explicit rate-limit classification
  (Phase 1.1). Mitigated now by the conservative default cap of 2.
- All existing recovery (dead-pid reconcile, wall-clock timeout kill, auth-failure
  global pause) is unchanged and now also covers `dispatch-one`-spawned workers
  (they write the same inflight records).

## Testing

Per the repo testing policy (Vitest; bug fixes need a red-before-green regression
test). New/updated Vitest suites:

- `tiers.test.ts` — precedence (inline wins; label when no inline; default when
  neither), unknown values ignored, env override of `modelForTier`.
- `dispatch.test.ts` — `claudeArgs` appends `--model` iff a model is given; order/shape
  of args; `buildDispatchEnv` unchanged.
- `budget.test.ts` — **regression for the overshoot bug**: window-cap nearly reached
  + slots > remaining ⇒ budget clamps so the per-window/day cap is not exceeded;
  named `it('does not exceed the per-window cap when concurrency slots exceed remaining budget')`.
- `labels.test.ts` — tier labels present in the synced set.
- `dispatch-one` — pure parts (arg parse + tier resolution) unit-tested; the spawn
  shell is thin I/O like `acdc-watch.ts` and stays untested by the same convention.

Fast gate before "done": `pnpm -C scripts/acdc run typecheck`, lint, and Vitest all
green; no `.skip`/`.only`.

## Acceptance criteria (test-shaped)

- [ ] `resolveTier('high', ['tier:low'], 'medium') === 'high'` (inline wins).
- [ ] `resolveTier(undefined, ['tier:high'], 'medium') === 'high'` (label used).
- [ ] `resolveTier(undefined, [], 'medium') === 'medium'` (default).
- [ ] `resolveTier('bogus', ['tier:bogus'], 'medium') === 'medium'` (unknowns ignored).
- [ ] `claudeArgs(p, s, 'opus')` contains `['--model','opus']`; `claudeArgs(p, s)` contains no `--model`.
- [ ] With `dispatchesThisWindow = maxPerWindow - 1` and `slots = 3`,
      `dispatchBudget(...) === 1` (never overshoots).
- [ ] The watcher dispatch loop dispatches at most `dispatchBudget(...)` workers per tick.
- [ ] `tsx bin/dispatch-one.ts <issue> high` spawns a worker whose `claude` args include
      `--model opus` and writes an `~/.acdc/inflight/issue-<n>.json` record.
- [ ] `tier:low|medium|high` appear in the label set produced by the sync-labels source.
- [ ] No change to scope-gate, green-bar, merge decision, or attribution behavior
      (their existing suites pass unchanged).

## Phase 2 (sketch — not built here)

A coordinator entry that takes one larger ticket (or a small spec), uses
`writing-plans` to produce a checkbox plan, decomposes it into atomic sub-tasks, and
fans them out across sibling worktrees — reusing `tiers`, the extracted dispatch
helper, and `dispatchBudget`. Optionally adopt the swarm's ownership-based
leaked-refs guard if danger-full-access dispatch is ever introduced. The Phase-1
factoring (pure tier/budget modules + a shared dispatch helper) is chosen so Phase 2
needs no rewrite.

## Files touched (Phase 1)

Source: `scripts/acdc/src/tiers.ts` (new), `scripts/acdc/src/watcher/budget.ts`
(new), `scripts/acdc/src/watcher/dispatch.ts`, `scripts/acdc/bin/dispatch-one.ts`
(new), `scripts/acdc/bin/acdc-watch.ts`, `scripts/acdc/src/watcher/config.ts`,
`scripts/acdc/src/labels.ts`, `scripts/acdc/bin/sync-labels.ts`, the labels source,
`.claude/commands/acdc.md`. Tests alongside each pure module.

> Note: `scripts/acdc/` and `.claude/` are ACDC's own scope-gate-protected paths
> (CODEOWNER-gated for agent runs). This is maintainer-driven work on a feature
> branch (`feat/acdc-tiers-parallel-dispatch`), never on `main`.
