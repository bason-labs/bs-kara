import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMock = vi.fn().mockResolvedValue(undefined);
const refMock = vi.fn(() => ({ update: updateMock }));

vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
  getAdminApp: vi.fn(() => ({})),
}));

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({ ref: refMock })),
  ServerValue: { increment: (n: number) => ({ '.sv': `increment:${n}` }) },
}));

// ptDateKey must be mockable — we fix the date to "20260515" for stable paths.
vi.mock('@/lib/ptDateKey', () => ({
  ptDateKey: vi.fn(() => '20260515'),
}));

import { recordSearchTotal, recordSearchLive } from './serverAnalytics';

describe('serverAnalytics', () => {
  beforeEach(() => {
    updateMock.mockClear();
    refMock.mockClear();
  });

  it('recordSearchTotal increments searchCounts total at the current date key', () => {
    recordSearchTotal();
    expect(refMock).toHaveBeenCalledWith('/');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        'analytics/searchCounts/20260515/total': expect.anything(),
      }),
    );
    // Must NOT touch live or quota
    const arg = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(arg)).toEqual(['analytics/searchCounts/20260515/total']);
  });

  it('recordSearchLive increments searchCounts live AND youtubeQuota calls', () => {
    recordSearchLive();
    expect(refMock).toHaveBeenCalledWith('/');
    const arg = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      'analytics/searchCounts/20260515/live': expect.anything(),
      'analytics/youtubeQuota/20260515/calls': expect.anything(),
    });
    // Must NOT touch total
    expect(arg['analytics/searchCounts/20260515/total']).toBeUndefined();
  });

});
