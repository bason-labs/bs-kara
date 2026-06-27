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
// Refuse to clobber an existing inflight record (the watcher or a prior dispatch-one may
// already have an active worker for this issue). Overwriting it would spawn a second worker
// and orphan the first — the watcher could no longer reconcile/kill it. Check BEFORE spawning.
const inflightTarget = path.join(INFLIGHT_DIR, inflightFilename(issue));
if (fs.existsSync(inflightTarget)) {
  console.error(
    `issue #${issue} already has an active inflight record (${inflightTarget}) — refusing to ` +
      'double-dispatch; wait for it to finish or remove the record first',
  );
  process.exit(1);
}
const child = spawn('claude', claudeArgs(acdcRunPrompt(issue), SETTINGS_PATH, model), {
  cwd: REPO_ROOT,
  env: buildDispatchEnv(process.env, token, firebase),
  detached: true,
  stdio: 'ignore',
});
// Guard the pid: a failed spawn yields pid === undefined; recording -1 would later make
// the watcher treat the run as alive and, on timeout, call process.kill(-1) — signalling
// every process this user owns. Fail closed instead of writing a poisoned inflight record.
child.on('error', (err) => {
  console.error(`failed to spawn claude worker: ${err.message}`);
  process.exit(1);
});
if (child.pid === undefined) {
  console.error('claude worker did not start (no pid) — not recording an inflight run');
  process.exit(1);
}
child.unref();
// Unlike the watcher loop, a manual dispatch intentionally skips the board "In Progress"
// move + heartbeat comment; the inflight record still prevents a double-dispatch and the
// watcher's in-review sync / reconcile pick the run up.
fs.writeFileSync(inflightTarget, JSON.stringify(buildInflight(issue, child.pid, Date.now())));
console.log(`dispatched issue #${issue} at tier ${tier} (model ${model}), pid ${child.pid}`);
console.log('the watcher will reconcile + (if auto-merge) merge this run; follow it via `gh pr list`');
