import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadSiteUrl() {
  vi.resetModules();
  return (await import('./siteUrl')).SITE_URL;
}

describe('SITE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses NEXT_PUBLIC_SITE_URL when it is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://kara.example.com');
    expect(await loadSiteUrl()).toBe('https://kara.example.com');
  });

  it('falls back to localhost when NEXT_PUBLIC_SITE_URL is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    expect(await loadSiteUrl()).toBe('http://localhost:3000');
  });
});
