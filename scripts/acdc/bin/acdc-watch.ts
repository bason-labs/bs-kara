#!/usr/bin/env tsx
//
// ACDC watcher shell — a thin I/O loop. All decision logic lives in tested pure
// helpers under src/watcher/ (select, guards, runState, config, githubState,
// dispatch). This file only does I/O: read files, exec `gh`, spawn `claude`,
// write state files, sleep. Keep it dumb.
//
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { loadConfig, isPaused, type Config } from '../src/watcher/config';
import { selectDispatchable, type Ticket } from '../src/watcher/select';
import {
  withinLimits,
  canAutoMerge,
  type GuardState,
  type Limits,
} from '../src/watcher/guards';
import {
  classifyExit,
  reconcile,
  type InFlightRecord,
} from '../src/watcher/runState';
import { parseProjectItems } from '../src/watcher/githubState';
import {
  prIssuesFromList,
  itemsNeedingInReview,
  openWorkerPrs,
  itemsReadyToMerge,
  type OpenPr,
} from '../src/watcher/reviewSync';
import { acdcRunPrompt, buildDispatchEnv, claudeArgs } from '../src/watcher/dispatch';
import {
  buildMergeInput,
  decideMerge,
  resolveGatingIssue,
  autoMergeSetByHuman,
  type LabelTransition,
  type PrJson,
} from '../src/mergeDecision';
import {
  isBoardConfigured,
  readBoardConfig,
  itemEditArgs,
  type BoardConfig,
  type Status,
} from '../src/board';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const HOME = os.homedir();
const ACDC_DIR = path.join(HOME, '.acdc');
const INFLIGHT_DIR = path.join(ACDC_DIR, 'inflight');
const PAUSED_PATH = path.join(ACDC_DIR, 'paused');
const COUNTER_PATH = path.join(ACDC_DIR, 'counters.json');
const HEARTBEAT_PATH = path.join(ACDC_DIR, 'last-heartbeat');
const TOKEN_ENV_PATH = path.join(ACDC_DIR, 'claude-token.env');
const FIREBASE_ENV_PATH = path.join(ACDC_DIR, 'firebase.env');
const BOARD_ENV_PATH = path.join(ACDC_DIR, 'board.env');
const SETTINGS_PATH = '.claude/acdc-settings.json';
const DAY_MS = 24 * 60 * 60 * 1000;

// Each inflight record carries the dispatch attempt count alongside the
// reconcile-relevant fields, so crash recovery can escalate to needs-human.
type InflightFile = InFlightRecord & { attempt: number; itemId?: string };

interface Counters {
  windowStart: number;
  dayStart: number;
  dispatchesThisWindow: number;
  dispatchesToday: number;
  autoMergesThisWindow: number;
}

function log(msg: string): void {
  // launchd captures stdout to ~/.acdc/watch.log
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDirs(): void {
  fs.mkdirSync(INFLIGHT_DIR, { recursive: true });
}

// ---- small env-file reader (KEY=VALUE lines) ------------------------------
function readEnvFile(p: string): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

// ---- inflight record files -------------------------------------------------
function readInflight(): InflightFile[] {
  let names: string[];
  try {
    names = fs.readdirSync(INFLIGHT_DIR);
  } catch {
    return [];
  }
  const recs: InflightFile[] = [];
  for (const name of names) {
    if (!/^issue-\d+\.json$/.test(name)) continue;
    try {
      const rec = JSON.parse(
        fs.readFileSync(path.join(INFLIGHT_DIR, name), 'utf8'),
      ) as InflightFile;
      if (typeof rec.issue === 'number') recs.push(rec);
    } catch {
      // ignore corrupt record file
    }
  }
  return recs;
}

function inflightPath(issue: number): string {
  return path.join(INFLIGHT_DIR, `issue-${issue}.json`);
}

function writeInflight(rec: InflightFile): void {
  fs.writeFileSync(inflightPath(rec.issue), JSON.stringify(rec));
}

function deleteInflight(issue: number): void {
  try {
    fs.unlinkSync(inflightPath(issue));
  } catch {
    /* already gone */
  }
}

// ---- daily/window counters -------------------------------------------------
function readCounters(now: number): Counters {
  let c: Counters;
  try {
    c = JSON.parse(fs.readFileSync(COUNTER_PATH, 'utf8')) as Counters;
  } catch {
    c = {
      windowStart: now,
      dayStart: now,
      dispatchesThisWindow: 0,
      dispatchesToday: 0,
      autoMergesThisWindow: 0,
    };
  }
  // Roll the window every poll-window-ish hour and the day every 24h.
  if (now - c.windowStart >= 60 * 60 * 1000) {
    c.windowStart = now;
    c.dispatchesThisWindow = 0;
    c.autoMergesThisWindow = 0;
  }
  if (now - c.dayStart >= DAY_MS) {
    c.dayStart = now;
    c.dispatchesToday = 0;
  }
  return c;
}

function writeCounters(c: Counters): void {
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(c));
}

// ---- gh / board I/O --------------------------------------------------------
function boardItemId(cfg: BoardConfig, issue: number): string {
  try {
    return execFileSync(
      'gh',
      [
        'project',
        'item-list',
        cfg.number,
        '--owner',
        cfg.owner,
        '--format',
        'json',
        '--jq',
        `.items[] | select(.content.number==${issue}) | .id`,
      ],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return '';
  }
}

function boardItemStatus(cfg: BoardConfig, issue: number): string {
  try {
    return execFileSync(
      'gh',
      [
        'project',
        'item-list',
        cfg.number,
        '--owner',
        cfg.owner,
        '--format',
        'json',
        '--jq',
        `.items[] | select(.content.number==${issue}) | .status`,
      ],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return '';
  }
}

function moveBoard(cfg: BoardConfig, issue: number, status: Status): void {
  const itemId = boardItemId(cfg, issue);
  if (!itemId) {
    log(`issue #${issue} not on the board — skipping move to ${status}`);
    return;
  }
  try {
    execFileSync('gh', itemEditArgs(cfg, itemId, status), { stdio: 'ignore' });
  } catch (err) {
    log(`failed to move issue #${issue} to ${status}: ${(err as Error).message}`);
  }
}

function labelNeedsHuman(issue: number): void {
  try {
    execFileSync('gh', ['issue', 'edit', String(issue), '--add-label', 'needs-human'], {
      stdio: 'ignore',
    });
  } catch (err) {
    log(`failed to label issue #${issue} needs-human: ${(err as Error).message}`);
  }
}

function postHeartbeatComment(issue: number): void {
  try {
    execFileSync(
      'gh',
      ['issue', 'comment', String(issue), '--body', 'Picked up by ACDC — worker dispatched.'],
      { stdio: 'ignore' },
    );
  } catch (err) {
    log(`failed to post heartbeat comment on #${issue}: ${(err as Error).message}`);
  }
}

function fetchTickets(cfg: BoardConfig): Ticket[] {
  try {
    const raw = execFileSync(
      'gh',
      ['project', 'item-list', cfg.number, '--owner', cfg.owner, '--format', 'json'],
      { encoding: 'utf8' },
    );
    return parseProjectItems(raw);
  } catch (err) {
    log(`failed to list project items: ${(err as Error).message}`);
    return [];
  }
}

// Issue numbers with an open worker PR (head branch `run/issue-<N>`). The
// watcher runs from REPO_ROOT, so `gh pr list` targets the current repo.
function fetchOpenPrIssues(): Set<number> {
  try {
    const raw = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--json', 'number,headRefName'],
      { encoding: 'utf8' },
    );
    return prIssuesFromList(raw);
  } catch (err) {
    log(`failed to list open PRs: ${(err as Error).message}`);
    return new Set();
  }
}

// ---- watcher-side merge (the SOLE merge authority; the worker never merges) ----
function fetchOpenWorkerPrs(): OpenPr[] {
  try {
    const raw = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--json', 'number,headRefName,author'],
      { encoding: 'utf8' },
    );
    return openWorkerPrs(raw);
  } catch (err) {
    log(`failed to list open worker PRs: ${(err as Error).message}`);
    return [];
  }
}

// PR fields needed to decide + bind a merge. Superset of PrJson (assignable to it).
interface PrMergeView extends PrJson {
  headRefName?: string;
  closingIssuesReferences?: { number: number }[];
}

function prMergeView(pr: number): PrMergeView | null {
  try {
    const raw = execFileSync(
      'gh',
      [
        'pr',
        'view',
        String(pr),
        '--json',
        'reviews,statusCheckRollup,headRefName,closingIssuesReferences',
      ],
      { encoding: 'utf8' },
    );
    return JSON.parse(raw) as PrMergeView;
  } catch (err) {
    log(`failed to read PR #${pr}: ${(err as Error).message}`);
    return null;
  }
}

function fetchIssueLabels(issue: number): string[] {
  try {
    const raw = execFileSync(
      'gh',
      ['issue', 'view', String(issue), '--json', 'labels', '--jq', '[.labels[].name]'],
      { encoding: 'utf8' },
    );
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch (err) {
    log(`failed to read issue #${issue} labels: ${(err as Error).message}`);
    return [];
  }
}

// Confirm the auto-merge label was applied by a HUMAN, not the worker bot — so a
// worker that fabricates the label on its own issue (it has Issues:write for comments)
// cannot authorize its own merge. workerLogin is the bot identity, derived from the
// worker token itself (never trusted from hand-entered config). Fail-closed on any
// uncertainty: empty login or a gh error returns false.
// Require the auto-merge label to have been applied by a HUMAN (User-type) actor, so a
// non-User bot (a GitHub App / Action) cannot authorize a merge. NOTE: on a single-host
// setup the worker runs as the maintainer's own gh identity (Claude Code uses the machine
// login and ignores GH_TOKEN), so this cannot distinguish "the maintainer applied it" from
// "the worker, running as the maintainer, applied it" — that boundary is held by the runbook
// (the worker opens a PR and never labels/merges) + CodeRabbit, not by the credential.
function autoMergeIsHumanAuthorized(issue: number): boolean {
  try {
    // All auto-merge label/unlabel transitions in order, "event|actorType" per line
    // (raw scalar output is robust across --paginate pages). autoMergeSetByHuman then
    // checks the CURRENT state was set by a human, not a stale historical application.
    const raw = execFileSync(
      'gh',
      [
        'api',
        `repos/{owner}/{repo}/issues/${issue}/timeline`,
        '--paginate',
        '--jq',
        '.[] | select((.event=="labeled" or .event=="unlabeled") and .label.name=="auto-merge") | "\\(.event)|\\(.actor.type)"',
      ],
      { encoding: 'utf8' },
    );
    const transitions: LabelTransition[] = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [event, actorType] = line.split('|');
        return { event, actorType: actorType ?? '' };
      });
    return autoMergeSetByHuman(transitions);
  } catch (err) {
    log(`could not verify auto-merge authorship for #${issue}: ${(err as Error).message}`);
    return false; // fail closed
  }
}

function removeWorktree(issue: number): void {
  const wt = path.resolve(REPO_ROOT, '..', 'bs-kara-wt', `issue-${issue}`);
  try {
    execFileSync('git', ['worktree', 'remove', '--force', wt], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
  } catch {
    /* worktree may not exist on this host — best-effort cleanup */
  }
}

// The merge gate. For each In-review, agent-ready PR whose worker has FINISHED:
// bind it strictly to its gating issue, read the auto-merge label from that ISSUE
// (never the PR), and merge only if our gates pass AND the per-window cap allows.
// `gh pr merge` is itself enforced server-side by branch protection, so an attempt
// fails closed (PR left open) if GitHub would block it.
function runMergeStep(
  boardCfg: BoardConfig,
  tickets: Ticket[],
  inFlight: Set<number>,
  counters: Counters,
  limits: Limits,
): void {
  // Trusted PR authors (provenance): the maintainer login(s). The worker authors PRs as
  // the watcher's own gh identity, so deriving that login admits worker PRs while rejecting
  // external-fork PRs that mimic the run/issue-N head. Optionally extended via ACDC_MERGE_AUTHORS.
  const trustedAuthors = new Set<string>();
  for (const a of (process.env.ACDC_MERGE_AUTHORS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    trustedAuthors.add(a);
  }
  try {
    const me = execFileSync('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8' }).trim();
    if (me) trustedAuthors.add(me);
  } catch (err) {
    log(`merge step: could not resolve the watcher's gh login: ${(err as Error).message}`);
  }
  if (trustedAuthors.size === 0) {
    log('merge step: no trusted PR authors resolved — skipping (fail-closed)');
    return;
  }

  const ready = itemsReadyToMerge(tickets, fetchOpenWorkerPrs(), [...trustedAuthors]);
  for (const { issue, pr } of ready) {
    if (inFlight.has(issue)) continue; // worker still running — never merge mid-run
    const guard: GuardState = {
      dispatchesThisWindow: counters.dispatchesThisWindow,
      dispatchesToday: counters.dispatchesToday,
      autoMergesThisWindow: counters.autoMergesThisWindow,
    };
    if (!canAutoMerge(guard, limits)) {
      log('auto-merge window cap reached — leaving remaining PRs open');
      return;
    }
    try {
      const view = prMergeView(pr);
      if (!view) continue;
      // STRICT bind: the gating issue must be exactly the one the head branch encodes.
      const gIssue = resolveGatingIssue(view.headRefName ?? '', view.closingIssuesReferences);
      if (gIssue === null || gIssue !== issue) {
        log(`PR #${pr}: cannot bind to run/issue-${issue} gating issue — leaving open (fail-closed)`);
        continue;
      }
      const decision = decideMerge(buildMergeInput(view, fetchIssueLabels(gIssue)));
      if (!decision.merge) {
        log(`PR #${pr} (issue #${gIssue}) not merging: ${decision.reason}`);
        continue;
      }
      // The auto-merge authorization must have been applied by a human (User), not a bot.
      if (!autoMergeIsHumanAuthorized(gIssue)) {
        log(`PR #${pr} (issue #${gIssue}): auto-merge not human-authorized — leaving open`);
        continue;
      }
      // Approve first (the watcher is a different identity than the worker) so a
      // ruleset requiring a review is satisfied; best-effort.
      try {
        execFileSync('gh', ['pr', 'review', String(pr), '--approve'], { stdio: 'ignore' });
      } catch {
        /* approval may be unnecessary or blocked — merge fails closed if it was required */
      }
      execFileSync('gh', ['pr', 'merge', String(pr), '--merge', '--delete-branch'], {
        stdio: 'ignore',
      });
      log(`PR #${pr} (issue #${gIssue}) auto-merged by the watcher`);
      moveBoard(boardCfg, gIssue, 'Done');
      deleteInflight(gIssue);
      removeWorktree(gIssue);
      counters.autoMergesThisWindow += 1;
      writeCounters(counters); // persist per-merge so the cap holds within a tick
    } catch (err) {
      log(`PR #${pr}: merge attempt failed (left open): ${(err as Error).message}`);
    }
  }
}

// ---- notifications + pause -------------------------------------------------
function notify(message: string): void {
  try {
    execFileSync('osascript', ['-e', `display notification ${JSON.stringify(message)} with title "ACDC"`], {
      stdio: 'ignore',
    });
  } catch {
    /* notifications are best-effort */
  }
}

function writePaused(reason: string): void {
  try {
    fs.writeFileSync(PAUSED_PATH, `${new Date().toISOString()} ${reason}\n`);
  } catch {
    /* best-effort */
  }
}

// ---- crash / timeout recovery ---------------------------------------------
// Accepts the base InFlightRecord (what reconcile returns); `attempt` is read
// defensively since persisted records carry it.
function recoverDead(
  cfg: BoardConfig | null,
  rec: InFlightRecord & { attempt?: number },
  limits: Limits,
): void {
  if (cfg && boardItemStatus(cfg, rec.issue) === 'In Progress') {
    const attempt = (rec.attempt ?? 0) + 1;
    if (attempt > limits.maxAttempts) {
      log(`issue #${rec.issue} exceeded maxAttempts (${attempt}) — escalating to needs-human`);
      labelNeedsHuman(rec.issue);
    } else {
      log(`issue #${rec.issue} worker died — returning to Todo (attempt ${attempt})`);
      moveBoard(cfg, rec.issue, 'Todo');
    }
  }
  deleteInflight(rec.issue);
}

// ---- one poll iteration ----------------------------------------------------
async function tick(cfg: Config): Promise<void> {
  const now = Date.now();
  const limits: Limits = {
    maxPerWindow: cfg.maxTicketsPerWindow,
    maxPerDay: cfg.maxDispatchesPerDay,
    maxAutoMergesPerWindow: cfg.maxAutoMergesPerWindow,
    maxAttempts: cfg.maxAttempts,
  };

  // 1. kill switch
  if (isPaused(fs.existsSync, PAUSED_PATH)) {
    log('paused (kill switch present) — skipping iteration');
    return;
  }

  const boardCfg = isBoardConfigured(process.env) ? readBoardConfig(process.env) : null;
  if (!boardCfg) log('board not configured — running degraded (no board moves)');

  // 2. reconcile inflight against live PIDs
  const records = readInflight();
  const isAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const { alive, dead } = reconcile(records, isAlive);
  for (const rec of dead) recoverDead(boardCfg, rec, limits);

  // kill + return any alive worker past the wall-clock timeout
  const survivors: InFlightRecord[] = [];
  for (const rec of alive) {
    const ageMin = (now - rec.startedAt) / 60000;
    if (ageMin >= cfg.workerTimeoutMin) {
      log(`issue #${rec.issue} worker timed out (${ageMin.toFixed(1)}min) — killing pid ${rec.pid}`);
      try {
        process.kill(rec.pid);
      } catch {
        /* already gone */
      }
      recoverDead(boardCfg, rec, limits);
    } else {
      survivors.push(rec);
    }
  }

  // 3. re-derive state from the board
  const tickets = boardCfg ? fetchTickets(boardCfg) : [];
  const inFlight = new Set<number>(survivors.map((r) => r.issue));

  // 3b. sync board: move "In Progress" cards to "In review" once their worker
  // PR is open. The worker's own step-9 move is unreliable, so we drive it
  // watcher-side. Best-effort: skip if the board isn't configured.
  if (boardCfg) {
    try {
      const prIssues = fetchOpenPrIssues();
      for (const issueNum of itemsNeedingInReview(tickets, prIssues)) {
        log(`issue #${issueNum} has an open PR — moving board card to In review`);
        moveBoard(boardCfg, issueNum, 'In review');
      }
    } catch (err) {
      log(`In-review board sync failed: ${(err as Error).message}`);
    }
  }

  const counters = readCounters(now);

  // 3c. WATCHER-SIDE MERGE — the sole merge authority. The worker only proposes
  // (opens a PR); the watcher reads the auto-merge label from the ISSUE (the human's
  // ticket), binds the PR↔issue strictly, and merges green + CodeRabbit-approved PRs
  // whose worker has finished. PRs whose worker is still inflight are skipped.
  if (boardCfg) {
    try {
      runMergeStep(boardCfg, tickets, inFlight, counters, limits);
    } catch (err) {
      log(`merge step failed: ${(err as Error).message}`);
    }
  }

  // 4. dispatch guards
  const guard: GuardState = {
    dispatchesThisWindow: counters.dispatchesThisWindow,
    dispatchesToday: counters.dispatchesToday,
    autoMergesThisWindow: counters.autoMergesThisWindow,
  };
  const limitCheck = withinLimits(guard, limits);
  if (!limitCheck.ok) {
    log(`dispatch limits reached: ${limitCheck.reason} — skipping dispatch`);
    return;
  }

  // 5. select dispatchable tickets within remaining capacity
  const picks = selectDispatchable(tickets, inFlight, cfg.maxConcurrent);
  if (picks.length === 0) {
    log(`nothing to dispatch (inflight=${inFlight.size}, candidates=${tickets.length})`);
    writeCounters(counters);
    return;
  }

  // 6. dispatch — guarded on credentials being present
  const token = readEnvFile(TOKEN_ENV_PATH).CLAUDE_CODE_OAUTH_TOKEN ?? '';
  const firebase = readEnvFile(FIREBASE_ENV_PATH);
  if (!token) {
    log(`missing CLAUDE_CODE_OAUTH_TOKEN in ${TOKEN_ENV_PATH} — skipping dispatch`);
    writeCounters(counters);
    return;
  }
  if (Object.keys(firebase).length === 0) {
    log(`missing/empty ${FIREBASE_ENV_PATH} — skipping dispatch`);
    writeCounters(counters);
    return;
  }

  for (const ticket of picks) {
    const issue = ticket.number;
    log(`dispatching issue #${issue}`);
    if (boardCfg) moveBoard(boardCfg, issue, 'In Progress');

    const child = spawn('claude', claudeArgs(acdcRunPrompt(issue), SETTINGS_PATH), {
      cwd: REPO_ROOT,
      env: buildDispatchEnv(process.env, token, firebase),
      detached: false,
    });

    const rec: InflightFile = {
      issue,
      pid: child.pid ?? -1,
      startedAt: Date.now(),
      attempt: 0,
    };
    writeInflight(rec);
    postHeartbeatComment(issue);

    // bump dispatch counters immediately so a crash mid-loop still counts
    counters.dispatchesThisWindow += 1;
    counters.dispatchesToday += 1;
    writeCounters(counters);

    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('exit', (code) => {
      const { kind } = classifyExit(code ?? 1, stderr);
      if (kind === 'success') {
        log(`issue #${issue} worker exited cleanly`);
        deleteInflight(issue);
      } else if (kind === 'auth') {
        log(`issue #${issue} worker hit an auth failure — pausing`);
        writePaused('auth failure in worker');
        notify('ACDC paused: worker auth failure (refresh OAuth token)');
        deleteInflight(issue);
      } else {
        log(`issue #${issue} worker crashed (code ${code}) — recovering`);
        const cur = readInflight().find((r) => r.issue === issue);
        recoverDead(boardCfg, cur ?? rec, limits);
      }
    });
  }

  writeCounters(counters);
}

// ---- daily "watcher alive" heartbeat --------------------------------------
function maybeHeartbeat(now: number): void {
  let last = 0;
  try {
    last = parseInt(fs.readFileSync(HEARTBEAT_PATH, 'utf8').trim(), 10) || 0;
  } catch {
    /* none yet */
  }
  if (now - last >= DAY_MS) {
    log('watcher alive');
    try {
      fs.writeFileSync(HEARTBEAT_PATH, String(now));
    } catch {
      /* best-effort */
    }
  }
}

// ---- main loop -------------------------------------------------------------
async function main(): Promise<void> {
  ensureDirs();
  // Self-load board config (ACDC_*) from ~/.acdc/board.env so the watcher works under
  // launchd, which does not source it. Pre-existing env wins (explicit override).
  for (const [k, v] of Object.entries(readEnvFile(BOARD_ENV_PATH))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  log('ACDC watcher starting');
  for (;;) {
    const cfg = loadConfig(process.env);
    maybeHeartbeat(Date.now());
    try {
      await tick(cfg);
    } catch (err) {
      log(`tick error: ${(err as Error).stack ?? (err as Error).message}`);
    }
    await sleep(cfg.pollSeconds * 1000);
  }
}

main().catch((err) => {
  log(`fatal: ${(err as Error).stack ?? String(err)}`);
  process.exit(1);
});
