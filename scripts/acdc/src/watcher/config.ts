import { coerceTier, type Tier } from '../tiers';

export interface Config {
  pollSeconds: number; maxConcurrent: number; workerTimeoutMin: number;
  maxTicketsPerWindow: number; maxDispatchesPerDay: number; maxAutoMergesPerWindow: number; maxAttempts: number;
  defaultTier: Tier;
  // Opt-in: when true the watcher auto-merges green PRs WITHOUT a human auto-merge label
  // (every other gate — CI, the independent CodeRabbit/Sonar gate, blocking findings,
  // strict bind, trusted author, per-window cap — still applies). Default false.
  autoMergeWithoutLabel: boolean;
}
const DEFAULTS: Config = { pollSeconds: 300, maxConcurrent: 2, workerTimeoutMin: 45, maxTicketsPerWindow: 4, maxDispatchesPerDay: 12, maxAutoMergesPerWindow: 3, maxAttempts: 2, defaultTier: 'medium', autoMergeWithoutLabel: false };
function intEnv(env: NodeJS.ProcessEnv, key: string, def: number): number {
  const v = env[key]; const n = v ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? n : def;
}
function boolEnv(env: NodeJS.ProcessEnv, key: string, def: boolean): boolean {
  const v = env[key]?.trim().toLowerCase();
  if (v === undefined) return def;
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return def;
}
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    pollSeconds: Math.min(1800, Math.max(60, intEnv(env, 'ACDC_POLL_SECONDS', DEFAULTS.pollSeconds))),
    maxConcurrent: intEnv(env, 'ACDC_MAX_CONCURRENT', DEFAULTS.maxConcurrent),
    workerTimeoutMin: intEnv(env, 'ACDC_WORKER_TIMEOUT_MIN', DEFAULTS.workerTimeoutMin),
    maxTicketsPerWindow: intEnv(env, 'ACDC_MAX_TICKETS_PER_WINDOW', DEFAULTS.maxTicketsPerWindow),
    maxDispatchesPerDay: intEnv(env, 'ACDC_MAX_DISPATCHES_PER_DAY', DEFAULTS.maxDispatchesPerDay),
    maxAutoMergesPerWindow: intEnv(env, 'ACDC_MAX_AUTOMERGES_PER_WINDOW', DEFAULTS.maxAutoMergesPerWindow),
    maxAttempts: intEnv(env, 'ACDC_MAX_ATTEMPTS', DEFAULTS.maxAttempts),
    defaultTier: coerceTier(env.ACDC_DEFAULT_TIER, DEFAULTS.defaultTier),
    autoMergeWithoutLabel: boolEnv(env, 'ACDC_AUTO_MERGE_WITHOUT_LABEL', DEFAULTS.autoMergeWithoutLabel),
  };
}
export function isPaused(exists: (p: string) => boolean, pausedPath: string): boolean { return exists(pausedPath); }
