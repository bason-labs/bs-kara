/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/registeredUsers', () => ({
  registerUser: vi.fn(),
  lookupUserByPhone: vi.fn(),
}));

import { registerUser, lookupUserByPhone } from '@/lib/registeredUsers';
import { useCreateSubscription } from './useCreateSubscription';

const registerMock = registerUser as ReturnType<typeof vi.fn>;
const lookupMock = lookupUserByPhone as ReturnType<typeof vi.fn>;

const BASE_INPUT = {
  userPhone: '0912345678',
  type: 'trial' as const,
  durationDays: 14,
  paymentRef: '',
  startDate: null,
};

function mockFetch(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useCreateSubscription', () => {
  it('on 201 success, calls registerUser with the typed phone and returns roomCode', async () => {
    mockFetch(201, { id: 'sub-1' });
    registerMock.mockResolvedValue({ roomCode: '5678', normalizedPhone: '84912345678' });

    const { result } = renderHook(() => useCreateSubscription());

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(BASE_INPUT);
    });

    expect(registerMock).toHaveBeenCalledWith({ phone: BASE_INPUT.userPhone });
    expect(outcome).toMatchObject({ ok: true, id: 'sub-1', roomCode: '5678' });
  });

  it('if registerUser throws "already registered", falls back to lookupUserByPhone', async () => {
    mockFetch(201, { id: 'sub-1' });
    registerMock.mockRejectedValue(new Error('Phone number already registered'));
    lookupMock.mockResolvedValue({
      roomCode: '9999',
      suspended: false,
      normalizedPhone: '84912345678',
      createdAt: 0,
    });

    const { result } = renderHook(() => useCreateSubscription());

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(BASE_INPUT);
    });

    expect(lookupMock).toHaveBeenCalledWith(BASE_INPUT.userPhone);
    expect(outcome).toMatchObject({ ok: true, roomCode: '9999' });
  });

  it('if registerUser throws for another reason, roomCode is null but subscription succeeds', async () => {
    mockFetch(201, { id: 'sub-1' });
    registerMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useCreateSubscription());

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(BASE_INPUT);
    });

    expect(outcome).toMatchObject({ ok: true, id: 'sub-1', roomCode: null });
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('on 400 failure, does not call registerUser', async () => {
    mockFetch(400, { error: 'invalid_input', fields: { userPhone: 'bad' } });

    const { result } = renderHook(() => useCreateSubscription());

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      outcome = await result.current.submit(BASE_INPUT);
    });

    expect(registerMock).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ ok: false });
  });
});
