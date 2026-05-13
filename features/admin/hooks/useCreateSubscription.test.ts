import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateSubscription } from './useCreateSubscription';

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

const validInput = {
  userPhone: '0901234567',
  type: 'trial' as const,
  durationDays: 14,
  paymentRef: '',
  startDate: null,
};

describe('useCreateSubscription', () => {
  it('201 → { ok: true, id }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'new-1' }));
    const { result } = renderHook(() => useCreateSubscription());
    let outcome;
    await act(async () => {
      outcome = await result.current.submit(validInput);
    });
    expect(outcome).toEqual({ ok: true, id: 'new-1' });
    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.fieldErrors).toEqual({});
  });

  it('400 with fields → populates fieldErrors', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: 'invalid_input',
        fields: { userPhone: 'bad', durationDays: 'out of range' },
      }),
    );
    const { result } = renderHook(() => useCreateSubscription());
    await act(async () => {
      await result.current.submit(validInput);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.fieldErrors).toEqual({
      userPhone: 'bad',
      durationDays: 'out of range',
    });
  });

  it('409 → top-level error with response message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: 'trial_already_claimed',
        message: 'Số điện thoại này đã sử dụng dùng thử trước đó.',
      }),
    );
    const { result } = renderHook(() => useCreateSubscription());
    await act(async () => {
      await result.current.submit(validInput);
    });
    expect(result.current.error).toContain('đã sử dụng dùng thử');
  });

  it('network error → generic Vietnamese error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useCreateSubscription());
    await act(async () => {
      await result.current.submit(validInput);
    });
    expect(result.current.error).toContain('Không thể tạo gói');
  });

  it('5xx → generic Vietnamese error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { error: 'internal' }),
    );
    const { result } = renderHook(() => useCreateSubscription());
    await act(async () => {
      await result.current.submit(validInput);
    });
    expect(result.current.error).toContain('Không thể tạo gói');
  });

  it('omits paymentRef from body when type=trial; includes when type=paid', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'x' }));
    const { result } = renderHook(() => useCreateSubscription());
    await act(async () => {
      await result.current.submit(validInput);
    });
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect('paymentRef' in body1).toBe(false);

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'y' }));
    await act(async () => {
      await result.current.submit({
        ...validInput,
        type: 'paid',
        paymentRef: 'PAY-X',
        durationDays: 30,
      });
    });
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body2.paymentRef).toBe('PAY-X');
  });

  it('omits startDate from body when null; includes when set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'x' }));
    const { result } = renderHook(() => useCreateSubscription());
    await act(async () => {
      await result.current.submit(validInput);
    });
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect('startDate' in body1).toBe(false);

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'y' }));
    await act(async () => {
      await result.current.submit({ ...validInput, startDate: 12345 });
    });
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body2.startDate).toBe(12345);
  });
});
