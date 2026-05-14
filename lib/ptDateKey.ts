/**
 * Returns a YYYYMMDD date key in America/Los_Angeles (PT) timezone.
 * daysAgo = 0 → today, daysAgo = 1 → yesterday, etc.
 */
export function ptDateKey(daysAgo: number = 0): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
    .format(d)
    .replace(/-/g, '');
}
