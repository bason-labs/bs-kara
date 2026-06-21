export interface InFlightRecord { issue: number; pid: number; startedAt: number }
export type ExitKind = 'success' | 'auth' | 'crash';
const AUTH_PATTERNS = [/oauth token expired/i, /invalid api key/i, /user interaction is not allowed/i, /unauthor/i, /\blogin\b/i];
export function classifyExit(code: number, stderr: string): { kind: ExitKind } {
  if (code === 0) return { kind: 'success' };
  if (AUTH_PATTERNS.some((re) => re.test(stderr))) return { kind: 'auth' };
  return { kind: 'crash' };
}
export function reconcile(records: InFlightRecord[], isAlive: (pid: number) => boolean) {
  return { alive: records.filter((r)=>isAlive(r.pid)), dead: records.filter((r)=>!isAlive(r.pid)) };
}
