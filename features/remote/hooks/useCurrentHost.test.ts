// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }));

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/database', () => ({ ref: vi.fn(), get: vi.fn() }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));
vi.mock('@/lib/registeredUsers', () => ({
  lookupUserByPhone: (...args: unknown[]) => mockLookup(...args),
}));

import * as firebaseAuth from 'firebase/auth';
import { renderHook, waitFor } from '@testing-library/react';
import { useCurrentHost } from './useCurrentHost';

const onAuthStateChangedMock = firebaseAuth.onAuthStateChanged as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  });
});

describe('useCurrentHost', () => {
  it('returns null user and null profile when not logged in', async () => {
    const { result } = renderHook(() => useCurrentHost());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('looks up profile when user has a phone number', async () => {
    const fakeProfile = { roomCode: '5678', normalizedPhone: '84905005678', suspended: false, createdAt: 0 };
    onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (u: { uid: string; phoneNumber: string }) => void) => {
      cb({ uid: 'u1', phoneNumber: '+84905005678' });
      return () => {};
    });
    mockLookup.mockResolvedValueOnce(fakeProfile);

    const { result } = renderHook(() => useCurrentHost());
    await waitFor(() => expect(result.current.profile?.roomCode).toBe('5678'));

    expect(mockLookup).toHaveBeenCalledWith('+84905005678');
  });

  it('sets profile to null when lookup returns null (unregistered auth user)', async () => {
    onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (u: { uid: string; phoneNumber: string }) => void) => {
      cb({ uid: 'u1', phoneNumber: '+84905005678' });
      return () => {};
    });
    mockLookup.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useCurrentHost());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
  });
});
