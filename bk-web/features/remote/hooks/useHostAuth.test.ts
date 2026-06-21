// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockOnAuthStateChanged } = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: mockOnAuthStateChanged,
}));

import { renderHook } from '@testing-library/react';
import { useHostAuth } from './useHostAuth';

beforeEach(() => {
  vi.clearAllMocks();
  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  });
});

describe('useHostAuth', () => {
  it('isHost is false when no user is logged in', () => {
    const { result } = renderHook(() => useHostAuth('uid-abc'));
    expect(result.current.isHost).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('isHost is true when logged-in uid matches hostUid', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: { uid: string }) => void) => {
      cb({ uid: 'uid-abc' });
      return () => {};
    });
    const { result } = renderHook(() => useHostAuth('uid-abc'));
    expect(result.current.isHost).toBe(true);
  });

  it('isHost is false when logged-in uid does not match hostUid', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: { uid: string }) => void) => {
      cb({ uid: 'uid-xyz' });
      return () => {};
    });
    const { result } = renderHook(() => useHostAuth('uid-abc'));
    expect(result.current.isHost).toBe(false);
  });

  it('isHost is false when hostUid is null (legacy room)', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: { uid: string }) => void) => {
      cb({ uid: 'uid-abc' });
      return () => {};
    });
    const { result } = renderHook(() => useHostAuth(null));
    expect(result.current.isHost).toBe(false);
  });

  it('loading is false after auth resolves', () => {
    const { result } = renderHook(() => useHostAuth(null));
    expect(result.current.loading).toBe(false);
  });

  it('loading is true before auth resolves', () => {
    mockOnAuthStateChanged.mockImplementation(() => () => {});
    const { result } = renderHook(() => useHostAuth(null));
    expect(result.current.loading).toBe(true);
  });
});
