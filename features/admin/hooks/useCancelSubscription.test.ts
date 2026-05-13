import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCancelSubscription } from './useCancelSubscription';

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

describe('useCancelSubscription', () => {
  it('200 → { ok: true }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const { result } = renderHook(() => useCancelSubscription());
    let outcome;
    await act(async () => {
      outcome = await result.current.cancel('sub-1');
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.cancelling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('PATCH body is { action: "cancel" } with the correct id in the URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const { result } = renderHook(() => useCancelSubscription());
    await act(async () => {
      await result.current.cancel('sub-1');
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/admin/subscriptions/sub-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ action: 'cancel' });
  });

  it('404 → returns the response message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, {
        error: 'not_found',
        message: 'Không tìm thấy gói đăng ký.',
      }),
    );
    const { result } = renderHook(() => useCancelSubscription());
    let outcome;
    await act(async () => {
      outcome = await result.current.cancel('missing');
    });
    expect(outcome).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Không tìm thấy gói đăng ký.',
    });
    expect(result.current.error).toContain('Không tìm thấy');
  });

  it('409 → returns the response message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: 'already_cancelled',
        message: 'Gói đăng ký này đã được huỷ trước đó.',
      }),
    );
    const { result } = renderHook(() => useCancelSubscription());
    let outcome;
    await act(async () => {
      outcome = await result.current.cancel('sub-1');
    });
    expect(outcome).toEqual({
      ok: false,
      error: 'already_cancelled',
      message: 'Gói đăng ký này đã được huỷ trước đó.',
    });
  });

  it('network error → generic Vietnamese error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useCancelSubscription());
    let outcome;
    await act(async () => {
      outcome = await result.current.cancel('sub-1');
    });
    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.error).toContain('Không thể huỷ');
  });

  it('5xx → generic Vietnamese error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: 'internal' }),
    );
    const { result } = renderHook(() => useCancelSubscription());
    await act(async () => {
      await result.current.cancel('sub-1');
    });
    expect(result.current.error).toContain('Không thể huỷ');
  });
});
