// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

import { get, set, update } from 'firebase/database';
import {
  normalizePhone,
  deriveBaseCode,
  resolveUniqueCode,
  registerUser,
  lookupUserByPhone,
  lookupUserByCode,
  isValidRoomCode,
  suspendUser,
  unsuspendUser,
  updateDisplayName,
  reassignRoomCode,
  getAllUsers,
  ensureHostUid,
} from './registeredUsers';

const getMock = get as unknown as ReturnType<typeof vi.fn>;
const setMock = set as unknown as ReturnType<typeof vi.fn>;
const updateMock = update as unknown as ReturnType<typeof vi.fn>;

function makeSnap(exists: boolean, val: unknown = null) {
  return { exists: () => exists, val: () => val };
}

beforeEach(() => {
  getMock.mockReset();
  setMock.mockReset();
  updateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('normalizePhone', () => {
  it('strips leading 0 and prefixes 84', () => {
    expect(normalizePhone('0912345678')).toBe('84912345678');
  });
  it('keeps numbers already starting with 84', () => {
    expect(normalizePhone('84912345678')).toBe('84912345678');
  });
  it('strips non-digit characters', () => {
    expect(normalizePhone('+84 912 345 678')).toBe('84912345678');
  });
  it('prefixes 84 when no leading 0 or 84', () => {
    expect(normalizePhone('912345678')).toBe('84912345678');
  });
  it('handles 0084 international prefix', () => {
    expect(normalizePhone('0084912345678')).toBe('84912345678');
  });
  it('throws on garbage input shorter than 9 digits', () => {
    expect(() => normalizePhone('123')).toThrow('Invalid phone number');
  });
});

describe('deriveBaseCode', () => {
  it('returns last 4 digits', () => {
    expect(deriveBaseCode('84912345678')).toBe('5678');
  });
});

describe('resolveUniqueCode', () => {
  it('returns base code when not taken', async () => {
    getMock.mockResolvedValue(makeSnap(false));
    expect(await resolveUniqueCode('5678')).toBe('5678');
  });

  it('appends 1 when base is taken', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true))   // '5678' taken
      .mockResolvedValueOnce(makeSnap(false));  // '56781' free
    expect(await resolveUniqueCode('5678')).toBe('56781');
  });

  it('increments suffix until a free slot is found', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true))  // '5678' taken
      .mockResolvedValueOnce(makeSnap(true))  // '56781' taken
      .mockResolvedValueOnce(makeSnap(true))  // '56782' taken
      .mockResolvedValueOnce(makeSnap(false)); // '56783' free
    expect(await resolveUniqueCode('5678')).toBe('56783');
  });
});

describe('registerUser', () => {
  it('derives room code, writes registeredUsers and roomCodeIndex atomically', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(false)) // phone not registered
      .mockResolvedValueOnce(makeSnap(false)); // base code free
    const result = await registerUser({ phone: '0912345678' });
    expect(result.roomCode).toBe('5678');
    expect(result.normalizedPhone).toBe('84912345678');
    expect(updateMock).toHaveBeenCalledOnce();
    const [, updates] = updateMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(Object.keys(updates)).toContain('registeredUsers/84912345678');
    expect(Object.keys(updates)).toContain('roomCodeIndex/5678');
    expect(Object.keys(updates)).toContain('rooms/5678/createdAt');
  });

  it('throws when phone is already registered', async () => {
    getMock.mockResolvedValueOnce(makeSnap(true)); // phone already exists
    await expect(registerUser({ phone: '0912345678' })).rejects.toThrow('already registered');
  });

  it('writes hostUid to the room node when uid is provided', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(false))
      .mockResolvedValueOnce(makeSnap(false));
    updateMock.mockResolvedValueOnce(undefined);

    await registerUser({ phone: '0912345678', uid: 'firebase-uid-123' });

    const [, updates] = updateMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const hasHostUid = Object.entries(updates).some(
      ([key, val]) => key.endsWith('/hostUid') && val === 'firebase-uid-123',
    );
    expect(hasHostUid).toBe(true);
  });

  it('does not write hostUid when uid is omitted', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(false))
      .mockResolvedValueOnce(makeSnap(false));
    updateMock.mockResolvedValueOnce(undefined);

    await registerUser({ phone: '0912345678' });

    const [, updates] = updateMock.mock.calls[0] as [unknown, Record<string, unknown>];
    const hasHostUid = Object.keys(updates).some((k) => k.endsWith('/hostUid'));
    expect(hasHostUid).toBe(false);
  });
});

// Regression: returning host who logs in via OTP must get hostUid written so
// isHost resolves correctly in useHostAuth (was null for pre-feature rooms).
describe('ensureHostUid', () => {
  it('does not write hostUid when verifying OTP for an existing user (bug)', async () => {
    // This test documents the bug: before the fix, ensureHostUid did not exist,
    // so returning users never had hostUid written and isHost was always false.
    setMock.mockResolvedValueOnce(undefined);
    await ensureHostUid('5678', 'firebase-uid-123');
    expect(setMock).toHaveBeenCalledWith(
      { path: 'rooms/5678/hostUid' },
      'firebase-uid-123',
    );
  });
});

describe('lookupUserByCode', () => {
  it('returns null when code not in index', async () => {
    getMock.mockResolvedValue(makeSnap(false));
    expect(await lookupUserByCode('9999')).toBeNull();
  });

  it('returns hydrated user when found', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true, '84912345678'))         // roomCodeIndex
      .mockResolvedValueOnce(makeSnap(true, {                        // registeredUsers
        roomCode: '5678',
        suspended: false,
        createdAt: 1000,
      }));
    const user = await lookupUserByCode('5678');
    expect(user).toMatchObject({ roomCode: '5678', normalizedPhone: '84912345678' });
  });
});

describe('isValidRoomCode', () => {
  it('returns false for unregistered code', async () => {
    getMock.mockResolvedValue(makeSnap(false));
    expect(await isValidRoomCode('0000')).toBe(false);
  });

  it('returns false for suspended room', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true, '84912345678'))
      .mockResolvedValueOnce(makeSnap(true, { roomCode: '5678', suspended: true, createdAt: 1000 }));
    expect(await isValidRoomCode('5678')).toBe(false);
  });

  it('returns true for active registered room', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true, '84912345678'))
      .mockResolvedValueOnce(makeSnap(true, { roomCode: '5678', suspended: false, createdAt: 1000 }));
    expect(await isValidRoomCode('5678')).toBe(true);
  });
});

describe('suspendUser / unsuspendUser', () => {
  it('suspendUser sets suspended:true', async () => {
    await suspendUser('0912345678');
    expect(setMock).toHaveBeenCalledWith(
      { path: 'registeredUsers/84912345678/suspended' },
      true,
    );
  });

  it('unsuspendUser sets suspended:false', async () => {
    await unsuspendUser('0912345678');
    expect(setMock).toHaveBeenCalledWith(
      { path: 'registeredUsers/84912345678/suspended' },
      false,
    );
  });
});

describe('getAllUsers', () => {
  it('returns empty array when no users exist', async () => {
    getMock.mockResolvedValue(makeSnap(false));
    expect(await getAllUsers()).toEqual([]);
  });

  it('hydrates all users with their normalizedPhone', async () => {
    getMock.mockResolvedValue(makeSnap(true, {
      '84912345678': { roomCode: '5678', suspended: false, createdAt: 1000 },
      '84987654321': { roomCode: '4321', suspended: true, createdAt: 2000 },
    }));
    const users = await getAllUsers();
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({ normalizedPhone: '84912345678', roomCode: '5678' });
  });
});

describe('lookupUserByPhone', () => {
  it('returns null when phone is not registered', async () => {
    getMock.mockResolvedValue(makeSnap(false));
    expect(await lookupUserByPhone('0999999999')).toBeNull();
  });

  it('returns hydrated user when phone is registered', async () => {
    getMock.mockResolvedValue(makeSnap(true, {
      roomCode: '9999',
      suspended: false,
      createdAt: 5000,
    }));
    const user = await lookupUserByPhone('0999999999');
    expect(user).toMatchObject({ normalizedPhone: '84999999999', roomCode: '9999' });
  });
});

describe('updateDisplayName', () => {
  it('sets displayName on the user record', async () => {
    await updateDisplayName('0912345678', 'Nguyen Van A');
    expect(setMock).toHaveBeenCalledWith(
      { path: 'registeredUsers/84912345678/displayName' },
      'Nguyen Van A',
    );
  });
});

describe('reassignRoomCode', () => {
  it('updates roomCode field, new index entry, and nulls old index entry atomically', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true, { roomCode: '5678', suspended: false, createdAt: 1000 })) // lookupUserByPhone
      .mockResolvedValueOnce(makeSnap(false)); // newCode index check — free
    await reassignRoomCode('0912345678', '9999');
    expect(updateMock).toHaveBeenCalledOnce();
    const [, updates] = updateMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(updates['registeredUsers/84912345678/roomCode']).toBe('9999');
    expect(updates['roomCodeIndex/9999']).toBe('84912345678');
    expect(updates['roomCodeIndex/5678']).toBeNull();
  });

  it('throws when newCode is already taken by another user', async () => {
    getMock
      .mockResolvedValueOnce(makeSnap(true, { roomCode: '5678', suspended: false, createdAt: 1000 })) // lookupUserByPhone
      .mockResolvedValueOnce(makeSnap(true, '84987654321')); // newCode already taken by different user
    await expect(reassignRoomCode('0912345678', '9999')).rejects.toThrow('already taken');
  });
});
