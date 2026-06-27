import { describe, it, expect } from 'vitest';
import { loadConfig, isPaused } from './config';

describe('loadConfig', () => {
  it('returns defaults when env is empty', () => {
    const c = loadConfig({});
    expect(c).toEqual({
      pollSeconds: 300,
      maxConcurrent: 2,
      workerTimeoutMin: 45,
      maxTicketsPerWindow: 4,
      maxDispatchesPerDay: 12,
      maxAutoMergesPerWindow: 3,
      maxAttempts: 2,
      defaultTier: 'medium',
      autoMergeWithoutLabel: false,
    });
  });

  it('reads ACDC_MAX_CONCURRENT from env', () => {
    expect(loadConfig({ ACDC_MAX_CONCURRENT: '3' }).maxConcurrent).toBe(3);
  });

  it('enables autonomous merge for truthy ACDC_AUTO_MERGE_WITHOUT_LABEL values', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
      expect(loadConfig({ ACDC_AUTO_MERGE_WITHOUT_LABEL: v }).autoMergeWithoutLabel).toBe(true);
    }
  });

  it('keeps autonomous merge off for unset, falsy, or unrecognized values', () => {
    for (const v of ['0', 'false', 'no', 'off', 'maybe', '']) {
      expect(loadConfig({ ACDC_AUTO_MERGE_WITHOUT_LABEL: v }).autoMergeWithoutLabel).toBe(false);
    }
    expect(loadConfig({}).autoMergeWithoutLabel).toBe(false);
  });

  it('reads ACDC_DEFAULT_TIER from env', () => {
    expect(loadConfig({ ACDC_DEFAULT_TIER: 'high' }).defaultTier).toBe('high');
  });
  it('falls back to medium for an invalid ACDC_DEFAULT_TIER', () => {
    expect(loadConfig({ ACDC_DEFAULT_TIER: 'turbo' }).defaultTier).toBe('medium');
  });

  it('clamps ACDC_POLL_SECONDS to a minimum of 60', () => {
    expect(loadConfig({ ACDC_POLL_SECONDS: '10' }).pollSeconds).toBe(60);
  });

  it('clamps ACDC_POLL_SECONDS to a maximum of 1800', () => {
    expect(loadConfig({ ACDC_POLL_SECONDS: '9999' }).pollSeconds).toBe(1800);
  });
});

describe('isPaused', () => {
  it('returns the injected exists result', () => {
    expect(isPaused(() => true, '/tmp/paused')).toBe(true);
    expect(isPaused(() => false, '/tmp/paused')).toBe(false);
  });

  it('passes the pausedPath through to exists', () => {
    let seen = '';
    isPaused((p) => { seen = p; return false; }, '/var/run/acdc.paused');
    expect(seen).toBe('/var/run/acdc.paused');
  });
});
