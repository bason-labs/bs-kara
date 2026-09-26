import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('reports ok with the deployed version from APP_VERSION', async () => {
    vi.stubEnv('APP_VERSION', 'abc1234');

    const res = GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'abc1234' });
  });

  it('reports version "dev" when APP_VERSION is not set', async () => {
    vi.stubEnv('APP_VERSION', '');

    const res = GET();

    expect(await res.json()).toEqual({ ok: true, version: 'dev' });
  });

  // The deploy script polls this until it sees the new SHA, so a cached
  // response would make a fresh deploy look like the old one.
  it('is never cached', () => {
    const res = GET();

    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
