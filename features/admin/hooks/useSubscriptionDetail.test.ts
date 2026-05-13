import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSubscriptionDetail } from './useSubscriptionDetail';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validDetail = {
  record: {
    id: 'sub-1',
    userPhone: '+84901234567',
    userId: null,
    type: 'trial',
    status: 'active',
    durationDays: 14,
    startDate: 1_700_000_000_000,
    endDate: 1_700_000_000_000 + 14 * 86_400_000,
    source: 'manual_admin',
    paymentRef: null,
    createdBy: 'admin-uid',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  },
  derivedStatus: 'active',
  daysLeft: 14,
};

describe('useSubscriptionDetail', () => {
  it('200 → returns parsed data', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, validDetail));
    const { result } = renderHook(() => useSubscriptionDetail('sub-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(validDetail);
    expect(result.current.error).toBeNull();
  });

  it('404 → Vietnamese not-found message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { error: 'not_found' }),
    );
    const { result } = renderHook(() => useSubscriptionDetail('missing'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain('Không tìm thấy');
  });

  it('refetch re-fires the request', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, validDetail))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ...validDetail,
          derivedStatus: 'cancelled',
        }),
      );
    const { result } = renderHook(() => useSubscriptionDetail('sub-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.derivedStatus).toBe('active');
    act(() => result.current.refetch());
    await waitFor(() =>
      expect(result.current.data?.derivedStatus).toBe('cancelled'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('empty id → error without fetch', async () => {
    const { result } = renderHook(() => useSubscriptionDetail(''));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('Không tìm thấy');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('encodes id in the URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, validDetail));
    renderHook(() => useSubscriptionDetail('a b/c?d'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    // URL-encoded — no raw space/slash/question-mark in the path segment.
    expect(url).toContain('a%20b%2Fc%3Fd');
  });
});
