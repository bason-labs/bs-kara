import { describe, it, expect } from 'vitest';
import { acdcRunPrompt, buildDispatchEnv, claudeArgs } from './dispatch';

describe('acdcRunPrompt', () => {
  it('includes the issue number and the acdc-run skill name', () => {
    const p = acdcRunPrompt(42);
    expect(p).toContain('42');
    expect(p).toContain('acdc-run');
  });

  it('includes the untrusted-input, never-merge, and never-label guardrails', () => {
    const p = acdcRunPrompt(42);
    expect(p).toContain('untrusted');
    expect(p).toMatch(/do NOT merge|never run gh pr merge/i);
    expect(p).toMatch(/never add or change labels/i);
  });
});

describe('buildDispatchEnv', () => {
  it('removes ANTHROPIC API key/token even if present in base', () => {
    const base = { ANTHROPIC_API_KEY: 'sk-x', ANTHROPIC_AUTH_TOKEN: 'tok-x', PATH: '/bin' };
    const out = buildDispatchEnv(base, 'oauth-123', {});
    expect(out.ANTHROPIC_API_KEY).toBeUndefined();
    expect(out.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(out.PATH).toBe('/bin');
  });

  it('sets CLAUDE_CODE_OAUTH_TOKEN and merges firebase vars', () => {
    const out = buildDispatchEnv({}, 'oauth-123', {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'fb-key',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fb-proj',
    });
    expect(out.CLAUDE_CODE_OAUTH_TOKEN).toBe('oauth-123');
    expect(out.NEXT_PUBLIC_FIREBASE_API_KEY).toBe('fb-key');
    expect(out.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('fb-proj');
  });

  it('does not mutate the base env object', () => {
    const base = { ANTHROPIC_API_KEY: 'sk-x' };
    buildDispatchEnv(base, 'oauth-123', {});
    expect(base.ANTHROPIC_API_KEY).toBe('sk-x');
  });

  it('scrubs inherited GH_TOKEN / GITHUB_TOKEN so the worker never gets the watcher token', () => {
    const out = buildDispatchEnv({ GH_TOKEN: 'ghp_watcher', GITHUB_TOKEN: 'ghs_x' }, 'oauth-123', {});
    expect(out.GH_TOKEN).toBeUndefined();
    expect(out.GITHUB_TOKEN).toBeUndefined();
  });
});

describe('claudeArgs', () => {
  it('drops project/local settings via --setting-sources user and loads the scoped --settings', () => {
    expect(claudeArgs('do the thing', '.claude/acdc-settings.json')).toEqual([
      '-p',
      'do the thing',
      '--setting-sources',
      'user',
      '--settings',
      '.claude/acdc-settings.json',
      '--output-format',
      'json',
    ]);
  });
});
