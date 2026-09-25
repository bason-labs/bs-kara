// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }));

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/database', () => ({ getDatabase: vi.fn(), ref: vi.fn(), get: vi.fn() }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
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

const CACHE_KEY = 'bs_kara_host_profile';

describe('useCurrentHost', () => {
  // Regression: the home screen showed a loading skeleton for 200-500ms after
  // leaving a room because lookupUserByPhone (an async DB read) ran on every
  // mount. Fix: cache the profile in localStorage so subsequent mounts start
  // with loading=false and the correct button renders immediately.
  it('starts with loading=false and the cached profile when localStorage has data', async () => {
    const cachedProfile = { roomCode: '5678', normalizedPhone: '84905005678', suspended: false, createdAt: 0 };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedProfile));

    // Auth resolves with the same user so the cache stays valid
    onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (u: { uid: string; phoneNumber: string }) => void) => {
      cb({ uid: 'u1', phoneNumber: '+84905005678' });
      return () => {};
    });
    // lookupUserByPhone is still pending — lets us observe the initial cached state
    mockLookup.mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useCurrentHost());

    // Initial state from cache — must be immediate, no waiting
    expect(result.current.loading).toBe(false);
    expect(result.current.profile?.roomCode).toBe('5678');
  });

  it('writes the profile to localStorage after Firebase resolves', async () => {
    const fakeProfile = { roomCode: '1234', normalizedPhone: '84901001234', suspended: false, createdAt: 0 };
    onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (u: { uid: string; phoneNumber: string }) => void) => {
      cb({ uid: 'u1', phoneNumber: '+84901001234' });
      return () => {};
    });
    mockLookup.mockResolvedValueOnce(fakeProfile);

    const { result } = renderHook(() => useCurrentHost());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { roomCode: string } | null;
    expect(stored?.roomCode).toBe('1234');
  });

  it('clears the localStorage cache when the user logs out', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ roomCode: '5678', normalizedPhone: '84905005678', suspended: false, createdAt: 0 }));

    const { result } = renderHook(() => useCurrentHost());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(result.current.profile).toBeNull();
  });

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
