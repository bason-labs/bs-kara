import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getRoomCodeIndexEntryPath,
  getRegisteredUserPath,
  getRoomDataPath,
} from '@/lib/roomPaths';
import { byPhoneRoot, subscriptionPath } from '@/lib/subscriptions/paths';

// --- Firebase Admin mocks ---
type FakeSnap = { exists: () => boolean; val: () => unknown };
const snapshots: Record<string, FakeSnap> = {};

const refMock = vi.fn((path: string) => ({
  once: vi.fn().mockImplementation(() => {
    const snap = snapshots[path];
    return Promise.resolve(snap ?? { exists: () => false, val: () => null });
  }),
}));

vi.mock('@/features/admin/lib/firebaseAdmin', () => ({
  getAdminApp: vi.fn(() => ({})),
}));

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({ ref: refMock })),
}));

import { GET } from './route';

function snap(value: unknown): FakeSnap {
  return { exists: () => value !== null, val: () => value };
}

function makeReq(roomCode: string | null) {
  const url = roomCode
    ? `http://localhost/api/room-access?roomCode=${roomCode}`
    : 'http://localhost/api/room-access';
  return new NextRequest(url);
}

beforeEach(() => {
  Object.keys(snapshots).forEach((k) => delete snapshots[k]);
  refMock.mockClear();
});

function setupValidRoom(roomCode = '1234') {
  const normalizedPhone = '84912345678';
  const phoneE164 = '+84912345678';
  const subId = 'sub001';
  snapshots[getRoomCodeIndexEntryPath(roomCode)] = snap(normalizedPhone);
  snapshots[getRegisteredUserPath(normalizedPhone)] = snap({ suspended: false, roomCode });
  snapshots[byPhoneRoot(phoneE164)] = snap({ [subId]: true });
  snapshots[subscriptionPath(subId)] = snap({
    status: 'active',
    endDate: Date.now() + 86_400_000,
  });
  snapshots[`${getRoomDataPath(roomCode)}/guestsAllowed`] = snap(true);
}

describe('GET /api/room-access', () => {
  it('returns 400 for a missing roomCode param', async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(400);
    const body = await res.json() as { allowed: boolean; reason: string };
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe('room_not_found');
  });

  it('returns room_not_found when roomCode not in index', async () => {
    const res = await GET(makeReq('9999'));
    const body = await res.json() as { allowed: boolean; reason: string };
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe('room_not_found');
  });

  it('returns subscription_expired when no active subscription exists', async () => {
    const roomCode = '1234';
    const normalizedPhone = '84912345678';
    const phoneE164 = '+84912345678';
    const subId = 'sub001';
    snapshots[getRoomCodeIndexEntryPath(roomCode)] = snap(normalizedPhone);
    snapshots[getRegisteredUserPath(normalizedPhone)] = snap({ suspended: false, roomCode });
    snapshots[byPhoneRoot(phoneE164)] = snap({ [subId]: true });
    snapshots[subscriptionPath(subId)] = snap({
      status: 'active',
      endDate: Date.now() - 1000,
    });
    const res = await GET(makeReq(roomCode));
    const body = await res.json() as { allowed: boolean; reason: string };
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe('subscription_expired');
  });

  it('returns guests_not_allowed when guestsAllowed is false', async () => {
    const roomCode = '1234';
    setupValidRoom(roomCode);
    snapshots[`${getRoomDataPath(roomCode)}/guestsAllowed`] = snap(false);
    const res = await GET(makeReq(roomCode));
    const body = await res.json() as { allowed: boolean; reason: string };
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe('guests_not_allowed');
  });

  it('returns room_not_found when user is suspended', async () => {
    const roomCode = '1234';
    const normalizedPhone = '84912345678';
    snapshots[getRoomCodeIndexEntryPath(roomCode)] = snap(normalizedPhone);
    snapshots[getRegisteredUserPath(normalizedPhone)] = snap({ suspended: true, roomCode });
    const res = await GET(makeReq(roomCode));
    const body = await res.json() as { allowed: boolean; reason: string };
    expect(body.allowed).toBe(false);
    expect(body.reason).toBe('room_not_found');
  });

  it('returns ok when all checks pass', async () => {
    setupValidRoom('1234');
    const res = await GET(makeReq('1234'));
    expect(res.status).toBe(200);
    const body = await res.json() as { allowed: boolean; reason: string };
    expect(body.allowed).toBe(true);
    expect(body.reason).toBe('ok');
  });
});
