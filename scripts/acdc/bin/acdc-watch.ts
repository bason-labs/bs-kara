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
  circuitTripped,
  type GuardState,
  type Limits,
} from '../src/watcher/guards';
import {
  classifyExit,
  reconcile,
  type InFlightRecord,
} from '../src/watcher/runState';
import { parseProjectItems } from '../src/watcher/githubState';
import { acdcRunPrompt, buildDispatchEnv, claudeArgs } from '../src/watcher/dispatch';
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

  // 4. guards
  const counters = readCounters(now);
  const guard: GuardState = {
    dispatchesThisWindow: counters.dispatchesThisWindow,
    dispatchesToday: counters.dispatchesToday,
    autoMergesThisWindow: counters.autoMergesThisWindow,
  };
  if (circuitTripped(guard, limits)) {
    log('circuit breaker tripped (auto-merge cap) — pausing');
    writePaused('circuit breaker: auto-merge cap exceeded');
    notify('ACDC paused: auto-merge circuit breaker tripped');
    return;
  }
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
