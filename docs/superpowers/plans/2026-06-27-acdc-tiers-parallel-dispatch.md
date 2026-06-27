# ACDC Tiers + Safe Parallel Dispatch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ACDC capability-tier routing (haiku/sonnet/opus per ticket), safe cross-ticket parallelism, and a direct manual dispatch entry point — without changing its proposer/PR/watcher-merge model.

**Architecture:** All decision logic lands in pure, unit-tested modules under `scripts/acdc/src/`; the `bin/` files stay dumb I/O shells (existing ACDC convention). Tiers resolve via `inline → tier:* label → default`; a `dispatchBudget` helper clamps per-tick dispatches so raising `ACDC_MAX_CONCURRENT` can't overshoot the window/day caps; a new `bin/dispatch-one.ts` reuses the watcher's dispatch helpers to launch one worker at a chosen tier from a chat session.

**Tech Stack:** TypeScript (ESM), Node, tsx, Vitest. Workspace: `@bs-kara/acdc` (`scripts/acdc`). Commands: `pnpm -C scripts/acdc run {typecheck,lint,test}`.

**Spec:** `docs/superpowers/specs/2026-06-27-acdc-tiers-parallel-dispatch-design.md`

**Branch:** `feat/acdc-tiers-parallel-dispatch` (already created; never work on `main`).

**Commit rule:** Conventional Commits, body ≤100 cols, **no Claude/Anthropic attribution** (hard repo rule).

**Testing note:** This work touches only the `@bs-kara/acdc` tooling workspace — no `bk-web` route handler, no user-facing flow — so Vitest is the correct and sufficient layer; no Playwright e2e is warranted (per the testing policy's "state why" rule). `vitest.config.ts` includes only `src/**/*.test.ts`, so every testable unit lives in `src/`; `bin/` shells are I/O-only and untested by convention.

---

## File Structure

| File | Responsibility | New/Mod |
|---|---|---|
| `scripts/acdc/src/tiers.ts` | Tier type, model map, `resolveTier`, `modelForTier`, `coerceTier` (pure) | New |
| `scripts/acdc/src/tiers.test.ts` | Tier resolution + model-map tests | New |
| `scripts/acdc/src/watcher/dispatch.ts` | `claudeArgs` gains an optional `--model` | Mod |
| `scripts/acdc/src/watcher/dispatch.test.ts` | `--model` append behavior | Mod |
| `scripts/acdc/src/watcher/budget.ts` | `dispatchBudget` per-tick cap clamp (pure) | New |
| `scripts/acdc/src/watcher/budget.test.ts` | Overshoot regression | New |
| `scripts/acdc/src/watcher/config.ts` | `defaultTier`, `maxConcurrent` default 1→2 | Mod |
| `scripts/acdc/src/watcher/config.test.ts` | Updated defaults + `defaultTier` parsing | Mod |
| `scripts/acdc/src/labels.ts` | `TIER_LABEL_NAMES` | Mod |
| `scripts/acdc/src/labels.test.ts` | tier labels present | Mod |
| `.github/labels.json` | `tier:low|medium|high` entries | Mod |
| `scripts/acdc/src/watcher/envFile.ts` | `parseEnvFile` (pure) extracted from the watcher | New |
| `scripts/acdc/src/watcher/envFile.test.ts` | env-file parsing | New |
| `scripts/acdc/src/watcher/inflight.ts` | `InflightFile`, `inflightFilename`, `buildInflight` (pure) | New |
| `scripts/acdc/src/watcher/inflight.test.ts` | record/filename builders | New |
| `scripts/acdc/src/watcher/dispatchOne.ts` | `parseDispatchOneArgs` (pure) | New |
| `scripts/acdc/src/watcher/dispatchOne.test.ts` | arg parsing | New |
| `scripts/acdc/bin/acdc-watch.ts` | wire tiers + budget; use extracted helpers | Mod |
| `scripts/acdc/bin/dispatch-one.ts` | direct one-shot dispatch shell | New |
| `.claude/commands/acdc.md` | `tier=` argument + semantics | Mod |

---

## Task 1: Tier resolution module

**Files:**
- Create: `scripts/acdc/src/tiers.ts`
- Test: `scripts/acdc/src/tiers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/acdc/src/tiers.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTier, modelForTier, coerceTier, TIER_MODEL } from './tiers';

describe('resolveTier', () => {
  it('prefers the inline tier over a label and the default', () => {
    expect(resolveTier('high', ['tier:low'], 'medium')).toBe('high');
  });
  it('uses a tier:* label when no inline tier is given', () => {
    expect(resolveTier(undefined, ['agent-ready', 'tier:high'], 'medium')).toBe('high');
  });
  it('falls back to the default when neither inline nor label applies', () => {
    expect(resolveTier(undefined, ['agent-ready'], 'medium')).toBe('medium');
  });
  it('ignores unknown inline and label values (no throw)', () => {
    expect(resolveTier('bogus', ['tier:bogus'], 'medium')).toBe('medium');
  });
});

describe('modelForTier', () => {
  it('maps tiers to the default Claude model aliases', () => {
    expect(modelForTier('low', {})).toBe('haiku');
    expect(modelForTier('medium', {})).toBe('sonnet');
    expect(modelForTier('high', {})).toBe('opus');
  });
  it('honors an ACDC_TIER_<TIER> env override', () => {
    expect(modelForTier('high', { ACDC_TIER_HIGH: 'claude-opus-4-8' })).toBe('claude-opus-4-8');
  });
});

describe('coerceTier', () => {
  it('returns a valid tier and falls back to the default otherwise', () => {
    expect(coerceTier('low', 'medium')).toBe('low');
    expect(coerceTier('nope', 'medium')).toBe('medium');
    expect(coerceTier(undefined, 'high')).toBe('high');
  });
});

describe('TIER_MODEL', () => {
  it('exposes a model for every tier', () => {
    expect(Object.keys(TIER_MODEL).sort()).toEqual(['high', 'low', 'medium']);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -C scripts/acdc exec vitest run src/tiers.test.ts`
Expected: FAIL — `Cannot find module './tiers'`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/acdc/src/tiers.ts
export type Tier = 'low' | 'medium' | 'high';

const TIERS: readonly Tier[] = ['low', 'medium', 'high'];

// Tier → Claude `--model` value. Aliases (haiku/sonnet/opus) resolve to the current
// model of that family; override per-tier with ACDC_TIER_LOW|MEDIUM|HIGH to pin full ids.
export const TIER_MODEL: Record<Tier, string> = {
  low: 'haiku',
  medium: 'sonnet',
  high: 'opus',
};

function asTier(v: string | undefined): Tier | undefined {
  return v !== undefined && (TIERS as readonly string[]).includes(v) ? (v as Tier) : undefined;
}

// Validate a free-form string into a Tier, falling back to `def`.
export function coerceTier(v: string | undefined, def: Tier): Tier {
  return asTier(v) ?? def;
}

// Precedence: inline override → first `tier:*` label → default.
export function resolveTier(
  inline: string | undefined,
  labels: string[] | undefined,
  def: Tier = 'medium',
): Tier {
  const fromInline = asTier(inline);
  if (fromInline) return fromInline;
  for (const l of labels ?? []) {
    if (l.startsWith('tier:')) {
      const t = asTier(l.slice('tier:'.length));
      if (t) return t;
    }
  }
  return def;
}

export function modelForTier(tier: Tier, env: NodeJS.ProcessEnv = process.env): string {
  const override = env[`ACDC_TIER_${tier.toUpperCase()}`];
  return override && override.trim() ? override.trim() : TIER_MODEL[tier];
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -C scripts/acdc exec vitest run src/tiers.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/tiers.ts scripts/acdc/src/tiers.test.ts
git commit -m "feat(acdc): add capability-tier resolution (inline > label > default)"
```

---

## Task 2: Thread `--model` into the worker command

**Files:**
- Modify: `scripts/acdc/src/watcher/dispatch.ts`
- Test: `scripts/acdc/src/watcher/dispatch.test.ts`

- [ ] **Step 1: Add the failing test** (append inside the existing `describe('claudeArgs', …)` block)

```ts
  it('appends --model only when a model is given', () => {
    expect(claudeArgs('do the thing', '.claude/acdc-settings.json', 'opus')).toEqual([
      '-p', 'do the thing',
      '--setting-sources', 'user',
      '--settings', '.claude/acdc-settings.json',
      '--output-format', 'json',
      '--model', 'opus',
    ]);
    expect(claudeArgs('x', 's')).not.toContain('--model');
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/dispatch.test.ts`
Expected: FAIL — `claudeArgs` ignores the 3rd argument; `--model` not present.

- [ ] **Step 3: Modify `claudeArgs`**

Replace the existing `claudeArgs` function with:

```ts
// Args for spawning the headless `claude` worker. `--setting-sources user` drops
// project/local `.claude` settings; only the explicit scoped `--settings` applies.
// `model` (optional, a tier-resolved `--model` value) is appended only when set so the
// no-model call is byte-identical to the prior behavior.
export function claudeArgs(prompt: string, settingsPath: string, model?: string): string[] {
  const args = ['-p', prompt, '--setting-sources', 'user', '--settings', settingsPath, '--output-format', 'json'];
  if (model) args.push('--model', model);
  return args;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/dispatch.test.ts`
Expected: PASS — both the pre-existing no-model test and the new `--model` test pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/watcher/dispatch.ts scripts/acdc/src/watcher/dispatch.test.ts
git commit -m "feat(acdc): pass a tier-resolved --model to the claude worker"
```

---

## Task 3: `dispatchBudget` — the concurrency-safety clamp

**Files:**
- Create: `scripts/acdc/src/watcher/budget.ts`
- Test: `scripts/acdc/src/watcher/budget.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/acdc/src/watcher/budget.test.ts
import { describe, it, expect } from 'vitest';
import { dispatchBudget } from './budget';
import type { GuardState, Limits } from './guards';

const limits: Limits = { maxPerWindow: 4, maxPerDay: 12, maxAutoMergesPerWindow: 3, maxAttempts: 2 };
const state = (win: number, day: number): GuardState => ({
  dispatchesThisWindow: win, dispatchesToday: day, autoMergesThisWindow: 0,
});

describe('dispatchBudget', () => {
  it('does not exceed the per-window cap when concurrency slots exceed remaining budget', () => {
    // window has 1 left (3 of 4 used) but 3 concurrency slots are free → only 1 may dispatch
    expect(dispatchBudget(state(3, 5), limits, 3)).toBe(1);
  });
  it('clamps to the remaining daily ceiling', () => {
    expect(dispatchBudget(state(0, 11), limits, 4)).toBe(1);
  });
  it('returns the slot count when budget is ample', () => {
    expect(dispatchBudget(state(0, 0), limits, 2)).toBe(2);
  });
  it('never returns a negative number', () => {
    expect(dispatchBudget(state(9, 99), limits, 2)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/budget.test.ts`
Expected: FAIL — `Cannot find module './budget'`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/acdc/src/watcher/budget.ts
import type { GuardState, Limits } from './guards';

// How many workers may actually be dispatched THIS tick. `withinLimits` only gates
// whether to dispatch at all; with maxConcurrent > 1 a single tick could otherwise
// overshoot the per-window/day caps. Clamp the candidate count to the remaining budget.
export function dispatchBudget(state: GuardState, limits: Limits, slots: number): number {
  const windowLeft = limits.maxPerWindow - state.dispatchesThisWindow;
  const dayLeft = limits.maxPerDay - state.dispatchesToday;
  return Math.max(0, Math.min(slots, windowLeft, dayLeft));
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/budget.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/watcher/budget.ts scripts/acdc/src/watcher/budget.test.ts
git commit -m "feat(acdc): clamp per-tick dispatches to the window/day budget"
```

---

## Task 4: Config — `defaultTier` and a safe concurrency default

**Files:**
- Modify: `scripts/acdc/src/watcher/config.ts`
- Test: `scripts/acdc/src/watcher/config.test.ts`

- [ ] **Step 1: Update the failing tests**

In `config.test.ts`, replace the `toEqual({...})` in the "returns defaults when env is empty" test with:

```ts
    expect(c).toEqual({
      pollSeconds: 300,
      maxConcurrent: 2,
      workerTimeoutMin: 45,
      maxTicketsPerWindow: 4,
      maxDispatchesPerDay: 12,
      maxAutoMergesPerWindow: 3,
      maxAttempts: 2,
      defaultTier: 'medium',
    });
```

Then add two new tests inside `describe('loadConfig', …)`:

```ts
  it('reads ACDC_DEFAULT_TIER from env', () => {
    expect(loadConfig({ ACDC_DEFAULT_TIER: 'high' }).defaultTier).toBe('high');
  });
  it('falls back to medium for an invalid ACDC_DEFAULT_TIER', () => {
    expect(loadConfig({ ACDC_DEFAULT_TIER: 'turbo' }).defaultTier).toBe('medium');
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/config.test.ts`
Expected: FAIL — `defaultTier` missing; `maxConcurrent` is 1.

- [ ] **Step 3: Modify `config.ts`**

Add the import at the top:

```ts
import { coerceTier, type Tier } from '../tiers';
```

Extend the `Config` interface with `defaultTier: Tier;`:

```ts
export interface Config {
  pollSeconds: number; maxConcurrent: number; workerTimeoutMin: number;
  maxTicketsPerWindow: number; maxDispatchesPerDay: number; maxAutoMergesPerWindow: number; maxAttempts: number;
  defaultTier: Tier;
}
```

Update `DEFAULTS` (note `maxConcurrent: 2`):

```ts
const DEFAULTS: Config = { pollSeconds: 300, maxConcurrent: 2, workerTimeoutMin: 45, maxTicketsPerWindow: 4, maxDispatchesPerDay: 12, maxAutoMergesPerWindow: 3, maxAttempts: 2, defaultTier: 'medium' };
```

Add the `defaultTier` line to the object returned by `loadConfig` (after `maxAttempts`):

```ts
    defaultTier: coerceTier(env.ACDC_DEFAULT_TIER, DEFAULTS.defaultTier),
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/watcher/config.ts scripts/acdc/src/watcher/config.test.ts
git commit -m "feat(acdc): add defaultTier config and raise default concurrency to 2"
```

---

## Task 5: Tier labels

**Files:**
- Modify: `scripts/acdc/src/labels.ts`
- Modify: `.github/labels.json`
- Test: `scripts/acdc/src/labels.test.ts`

- [ ] **Step 1: Add the failing test** (append a new `it` inside `describe('labels.json', …)`)

First add `TIER_LABEL_NAMES` to the import on line 3:

```ts
import { parseLabels, AREA_LABEL_NAMES, TIER_LABEL_NAMES } from './labels';
```

Then add:

```ts
  it('contains every tier label exactly once', () => {
    const names = parseLabels(raw).map((l) => l.name);
    for (const t of TIER_LABEL_NAMES) {
      expect(names.filter((n) => n === t)).toHaveLength(1);
    }
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -C scripts/acdc exec vitest run src/labels.test.ts`
Expected: FAIL — `TIER_LABEL_NAMES` is not exported; tier labels absent from `labels.json`.

- [ ] **Step 3a: Add `TIER_LABEL_NAMES` to `labels.ts`** (after the `AREA_LABEL_NAMES` block)

```ts
export const TIER_LABEL_NAMES = [
  'tier:low',
  'tier:medium',
  'tier:high',
] as const;
```

- [ ] **Step 3b: Add the entries to `.github/labels.json`** (insert before the closing `]`, after `area:multiple`)

```json
  ,
  { "name": "tier:low", "color": "c2e0c6", "description": "Mechanical change — dispatch on the haiku tier" },
  { "name": "tier:medium", "color": "fef2c0", "description": "Standard judgment — dispatch on the sonnet tier" },
  { "name": "tier:high", "color": "d4c5f9", "description": "Hard design — dispatch on the opus tier" }
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `pnpm -C scripts/acdc exec vitest run src/labels.test.ts`
Expected: PASS. (The colors are valid 6-hex, satisfying the existing well-formed-label test.)

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/labels.ts scripts/acdc/src/labels.test.ts .github/labels.json
git commit -m "feat(acdc): add tier:low|medium|high labels for tier routing"
```

> After merge, run `pnpm -C scripts/acdc exec tsx bin/sync-labels.ts` once to create the labels on GitHub (no code change; uses the existing sync path).

---

## Task 6: Extract `parseEnvFile` and inflight helpers (no behavior change)

This DRYs the env-file reader and the inflight-record shape so the watcher and the new
`dispatch-one` share one definition. Pure extraction; the watcher's behavior is unchanged.

**Files:**
- Create: `scripts/acdc/src/watcher/envFile.ts`, `scripts/acdc/src/watcher/envFile.test.ts`
- Create: `scripts/acdc/src/watcher/inflight.ts`, `scripts/acdc/src/watcher/inflight.test.ts`
- Modify: `scripts/acdc/bin/acdc-watch.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/acdc/src/watcher/envFile.test.ts
import { describe, it, expect } from 'vitest';
import { parseEnvFile } from './envFile';

describe('parseEnvFile', () => {
  it('parses KEY=VALUE lines, skipping blanks and comments', () => {
    expect(parseEnvFile('A=1\n\n# c\nB=two\n')).toEqual({ A: '1', B: 'two' });
  });
  it('strips matching single or double quotes', () => {
    expect(parseEnvFile('A="x"\nB=\'y\'')).toEqual({ A: 'x', B: 'y' });
  });
  it('keeps = signs in the value', () => {
    expect(parseEnvFile('TOKEN=ab=cd')).toEqual({ TOKEN: 'ab=cd' });
  });
});
```

```ts
// scripts/acdc/src/watcher/inflight.test.ts
import { describe, it, expect } from 'vitest';
import { buildInflight, inflightFilename } from './inflight';

describe('inflight helpers', () => {
  it('builds a record with a zero default attempt', () => {
    expect(buildInflight(42, 1234, 1000)).toEqual({ issue: 42, pid: 1234, startedAt: 1000, attempt: 0 });
  });
  it('carries an explicit attempt', () => {
    expect(buildInflight(42, 1, 2, 3).attempt).toBe(3);
  });
  it('names the per-issue file', () => {
    expect(inflightFilename(42)).toBe('issue-42.json');
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/envFile.test.ts src/watcher/inflight.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3a: Create `envFile.ts`**

```ts
// scripts/acdc/src/watcher/envFile.ts
// Pure parser for KEY=VALUE env files (e.g. ~/.acdc/claude-token.env). The fs read
// stays in the I/O shells; this is the testable core.
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}
```

- [ ] **Step 3b: Create `inflight.ts`**

```ts
// scripts/acdc/src/watcher/inflight.ts
import type { InFlightRecord } from './runState';

// The persisted inflight record: reconcile-relevant fields + the dispatch attempt count.
export interface InflightFile extends InFlightRecord {
  attempt: number;
  itemId?: string;
}

export function inflightFilename(issue: number): string {
  return `issue-${issue}.json`;
}

export function buildInflight(issue: number, pid: number, startedAt: number, attempt = 0): InflightFile {
  return { issue, pid, startedAt, attempt };
}
```

- [ ] **Step 3c: Refactor `bin/acdc-watch.ts` to use them**

Add imports near the other `src/watcher` imports:

```ts
import { parseEnvFile } from '../src/watcher/envFile';
import { InflightFile, inflightFilename, buildInflight } from '../src/watcher/inflight';
```

Delete the local `type InflightFile = InFlightRecord & { attempt: number; itemId?: string };` declaration (now imported).

Replace the body of `readEnvFile` with the shared parser:

```ts
function readEnvFile(p: string): Record<string, string> {
  try {
    return parseEnvFile(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}
```

Change `inflightPath` to use the shared filename:

```ts
function inflightPath(issue: number): string {
  return path.join(INFLIGHT_DIR, inflightFilename(issue));
}
```

Replace the inline record literal in the dispatch loop:

```ts
    const rec: InflightFile = buildInflight(issue, child.pid ?? -1, Date.now());
```

- [ ] **Step 4: Verify nothing regressed**

Run: `pnpm -C scripts/acdc run typecheck && pnpm -C scripts/acdc run test`
Expected: typecheck clean; all existing + new suites PASS (the refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/watcher/envFile.ts scripts/acdc/src/watcher/envFile.test.ts \
        scripts/acdc/src/watcher/inflight.ts scripts/acdc/src/watcher/inflight.test.ts \
        scripts/acdc/bin/acdc-watch.ts
git commit -m "refactor(acdc): extract shared env-file + inflight helpers"
```

---

## Task 7: Wire tiers + budget into the watcher dispatch loop

**Files:**
- Modify: `scripts/acdc/bin/acdc-watch.ts`

No new unit test: this is the dumb I/O shell, and its logic is covered by the
`tiers`, `budget`, and `config` suites. Verification is typecheck + the full suite green.

- [ ] **Step 1: Add imports** (near the other `src/watcher` imports)

```ts
import { dispatchBudget } from '../src/watcher/budget';
import { resolveTier, modelForTier } from '../src/tiers';
```

- [ ] **Step 2: Clamp picks to the budget** — in `tick`, after the existing
`const picks = selectDispatchable(tickets, inFlight, cfg.maxConcurrent);` block (and
its `picks.length === 0` early return), insert:

```ts
  // Clamp this tick's dispatches to the remaining window/day budget so a cap > 1 can
  // never overshoot the per-window/day limits (withinLimits only gates "dispatch at all").
  const budget = dispatchBudget(guard, limits, picks.length);
  const toDispatch = picks.slice(0, budget);
  if (toDispatch.length === 0) {
    log('window/day budget exhausted for this tick — deferring remaining picks');
    writeCounters(counters);
    return;
  }
```

- [ ] **Step 3: Dispatch each pick at its resolved tier** — change the loop header
`for (const ticket of picks) {` to `for (const ticket of toDispatch) {`, and inside it,
right after `const issue = ticket.number;`, add:

```ts
    const tier = resolveTier(undefined, ticket.labels, cfg.defaultTier);
    const model = modelForTier(tier);
```

Update the dispatch log line and the spawn call to use the model:

```ts
    log(`dispatching issue #${issue} at tier ${tier} (${model})`);
```

```ts
    const child = spawn('claude', claudeArgs(acdcRunPrompt(issue), SETTINGS_PATH, model), {
      cwd: REPO_ROOT,
      env: buildDispatchEnv(process.env, token, firebase),
      detached: false,
    });
```

- [ ] **Step 4: Verify**

Run: `pnpm -C scripts/acdc run typecheck && pnpm -C scripts/acdc run lint && pnpm -C scripts/acdc run test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/bin/acdc-watch.ts
git commit -m "feat(acdc): dispatch each ticket at its resolved tier within the budget"
```

---

## Task 8: Direct dispatch entry point (`dispatch-one`)

**Files:**
- Create: `scripts/acdc/src/watcher/dispatchOne.ts`, `scripts/acdc/src/watcher/dispatchOne.test.ts`
- Create: `scripts/acdc/bin/dispatch-one.ts`

- [ ] **Step 1: Write the failing test for the pure arg parser**

```ts
// scripts/acdc/src/watcher/dispatchOne.test.ts
import { describe, it, expect } from 'vitest';
import { parseDispatchOneArgs } from './dispatchOne';

describe('parseDispatchOneArgs', () => {
  it('parses the issue number and a bare tier', () => {
    expect(parseDispatchOneArgs(['42', 'high'])).toEqual({ issue: 42, tier: 'high' });
  });
  it('accepts a tier=<v> form', () => {
    expect(parseDispatchOneArgs(['42', 'tier=low'])).toEqual({ issue: 42, tier: 'low' });
  });
  it('leaves tier undefined when omitted', () => {
    expect(parseDispatchOneArgs(['42'])).toEqual({ issue: 42, tier: undefined });
  });
  it('throws on a missing or non-numeric issue', () => {
    expect(() => parseDispatchOneArgs([])).toThrow(/issue/i);
    expect(() => parseDispatchOneArgs(['x'])).toThrow(/issue/i);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/dispatchOne.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3a: Write the pure parser**

```ts
// scripts/acdc/src/watcher/dispatchOne.ts
export interface DispatchOneArgs {
  issue: number;
  tier: string | undefined;
}

// argv (process.argv.slice(2)): "<issue> [tier]" where tier is bare (high) or tier=high.
export function parseDispatchOneArgs(argv: string[]): DispatchOneArgs {
  const issue = Number(argv[0]);
  if (!Number.isInteger(issue) || issue <= 0) {
    throw new Error('usage: dispatch-one <issue> [tier]  (issue must be a positive integer)');
  }
  let tier = argv[1];
  if (tier && tier.startsWith('tier=')) tier = tier.slice('tier='.length);
  return { issue, tier };
}
```

- [ ] **Step 3b: Write the I/O shell `bin/dispatch-one.ts`**

```ts
#!/usr/bin/env tsx
//
// Direct, one-shot ACDC dispatch — the chat-callable analogue of the watcher's
// auto-dispatch. Resolves a tier (inline arg > issue label > ACDC_DEFAULT_TIER), then
// spawns the SAME headless worker the watcher does (scoped settings, scrubbed env,
// inflight record), detached so it outlives this process and the watcher reconciles it.
//
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { parseDispatchOneArgs } from '../src/watcher/dispatchOne';
import { resolveTier, modelForTier, coerceTier } from '../src/tiers';
import { acdcRunPrompt, buildDispatchEnv, claudeArgs } from '../src/watcher/dispatch';
import { parseEnvFile } from '../src/watcher/envFile';
import { buildInflight, inflightFilename } from '../src/watcher/inflight';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const ACDC_DIR = path.join(os.homedir(), '.acdc');
const INFLIGHT_DIR = path.join(ACDC_DIR, 'inflight');
const SETTINGS_PATH = '.claude/acdc-settings.json';

function readEnvFile(p: string): Record<string, string> {
  try {
    return parseEnvFile(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function issueLabels(issue: number): string[] {
  try {
    const raw = execFileSync('gh', ['issue', 'view', String(issue), '--json', 'labels', '--jq', '[.labels[].name]'], {
      encoding: 'utf8',
    });
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const { issue, tier: tierArg } = parseDispatchOneArgs(process.argv.slice(2));
const tier = resolveTier(tierArg, issueLabels(issue), coerceTier(process.env.ACDC_DEFAULT_TIER, 'medium'));
const model = modelForTier(tier);

const token = readEnvFile(path.join(ACDC_DIR, 'claude-token.env')).CLAUDE_CODE_OAUTH_TOKEN ?? '';
const firebase = readEnvFile(path.join(ACDC_DIR, 'firebase.env'));
if (!token) {
  console.error(`missing CLAUDE_CODE_OAUTH_TOKEN in ${path.join(ACDC_DIR, 'claude-token.env')}`);
  process.exit(1);
}
if (Object.keys(firebase).length === 0) {
  console.error(`missing/empty ${path.join(ACDC_DIR, 'firebase.env')}`);
  process.exit(1);
}

fs.mkdirSync(INFLIGHT_DIR, { recursive: true });
const child = spawn('claude', claudeArgs(acdcRunPrompt(issue), SETTINGS_PATH, model), {
  cwd: REPO_ROOT,
  env: buildDispatchEnv(process.env, token, firebase),
  detached: true,
  stdio: 'ignore',
});
child.unref();
fs.writeFileSync(
  path.join(INFLIGHT_DIR, inflightFilename(issue)),
  JSON.stringify(buildInflight(issue, child.pid ?? -1, Date.now())),
);
console.log(`dispatched issue #${issue} at tier ${tier} (model ${model}), pid ${child.pid ?? '?'}`);
console.log('the watcher will reconcile + (if auto-merge) merge this run; follow it via `gh pr list`');
```

- [ ] **Step 4: Run the parser test + typecheck**

Run: `pnpm -C scripts/acdc exec vitest run src/watcher/dispatchOne.test.ts && pnpm -C scripts/acdc run typecheck`
Expected: PASS + clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add scripts/acdc/src/watcher/dispatchOne.ts scripts/acdc/src/watcher/dispatchOne.test.ts \
        scripts/acdc/bin/dispatch-one.ts
git commit -m "feat(acdc): add chat-callable one-shot dispatch at a chosen tier"
```

---

## Task 9: `/acdc` command — tier argument + semantics

**Files:**
- Modify: `.claude/commands/acdc.md`

Copy/doc change only (no test — the command is a prompt template).

- [ ] **Step 1: Update the command** — replace the body of `.claude/commands/acdc.md` (keep the `---`/`description` frontmatter) with text that:
  1. Parses `$ARGUMENTS` as `<issue> [tier=low|medium|high]`.
  2. States the two semantics explicitly:
     - **In-session run** (`/acdc 42`): runs the acdc-run skill in THIS session; the model is your current session model, so `tier=` is informational here.
     - **Headless tiered worker:** to dispatch a background worker at a specific tier, run
       `pnpm -C scripts/acdc exec tsx bin/dispatch-one.ts 42 <tier>`.
  3. Keeps the existing hard rules block (untrusted data; Conventional Commits, no
     attribution; never self-approve/merge/touch protected paths).

Concretely, append this section after the existing instructions and before the Hard rules:

```markdown
**Tier (optional).** `$ARGUMENTS` may include `tier=low|medium|high`. Running `/acdc N`
here drives the runbook in THIS session, so the model is whatever this session uses —
`tier=` is informational. To dispatch a background worker at a chosen model tier
(haiku/sonnet/opus), instead run:
`pnpm -C scripts/acdc exec tsx bin/dispatch-one.ts N <tier>` — it resolves the tier
(inline > the issue's `tier:*` label > `ACDC_DEFAULT_TIER`/medium) and launches the same
scoped worker the watcher uses.
```

- [ ] **Step 2: Sanity-check the file renders** (no tooling; just confirm valid Markdown + frontmatter intact).

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/acdc.md
git commit -m "docs(acdc): document tier= argument and headless tiered dispatch"
```

---

## Task 10: Full workspace verification

**Files:** none (gate).

- [ ] **Step 1: Run the full acdc gate**

Run: `pnpm -C scripts/acdc run typecheck && pnpm -C scripts/acdc run lint && pnpm -C scripts/acdc run test`
Expected output: typecheck clean, lint clean, Vitest all green (no `.skip`/`.only`).

- [ ] **Step 2: Confirm the no-overshoot acceptance criterion end-to-end**

Re-read `budget.test.ts` output: the test
`does not exceed the per-window cap when concurrency slots exceed remaining budget`
must be present and passing — this is the regression guard for the cap-overflow bug.

- [ ] **Step 3: Report** per CLAUDE.md Rule 6 (source files / test files / why each test exists), then stop. Do **not** open a PR or merge — this is maintainer branch work; integration is a separate human step.

---

## Self-review (completed at authoring)

- **Spec coverage:** tiers (T1, T2, T7), inline>label>default routing (T1), `--model`
  threading (T2), concurrency-safety/`dispatchBudget` (T3, T7), config defaults (T4),
  tier labels (T5), direct chat dispatch (T8), `/acdc` semantics (T9), merge model
  untouched (no task modifies the merge path — verified by leaving `runMergeStep`/
  `mergeDecision` alone). Codex/Phase 2 explicitly out.
- **Placeholder scan:** none — every code/step is concrete.
- **Type consistency:** `Tier`, `resolveTier`, `modelForTier`, `coerceTier`,
  `dispatchBudget`, `parseEnvFile`, `buildInflight`/`inflightFilename`,
  `parseDispatchOneArgs`, and `claudeArgs(…, model?)` names/signatures match across
  the producing task and every consumer (config, watcher, dispatch-one).
