# Multi-Room Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-active-room singleton with concurrent multi-room support where each registered phone number owns a permanent room code.

**Architecture:** Firebase RTDB gains two new top-level nodes — `registeredUsers/{phone}` for user records and `roomCodeIndex/{code}` for O(1) reverse lookup — plus a `meta/activeRooms/{code}: true` presence set replacing the `meta/activeRoom` singleton. The TV gets a lookup form before activating a room; the phone join screen becomes a plain code-entry form with Firebase validation instead of singleton matching. An `/admin` panel gated by Firebase Auth manages users and rooms.

**Tech Stack:** Next.js 15 App Router, Firebase RTDB (client SDK), Firebase Auth (already initialized in `lib/firebase.ts`), Vitest + Testing Library (unit), Playwright (E2E), Tailwind CSS.

---

## File Map

**New files:**
- `lib/registeredUsers.ts` — phone normalization, code derivation + collision resolution, user CRUD
- `lib/registeredUsers.test.ts` — unit tests for all registeredUsers functions
- `features/tv/components/TVRoomLookup.tsx` — TV room-lookup form (phone or code → activate)
- `app/admin/layout.tsx` — Firebase Auth guard for all `/admin` routes
- `app/admin/login/page.tsx` — admin email/password sign-in page
- `app/admin/page.tsx` — admin dashboard (user list + register form + active rooms)
- `app/admin/_components/RegisterUserForm.tsx` — register-user form
- `app/admin/_components/UserList.tsx` — registered users table with suspend/reassign actions
- `app/admin/_components/ActiveRoomsList.tsx` — live active rooms panel with force-end action

**Modified files:**
- `lib/roomPaths.ts` — remove `getActiveRoomPointerPath`, add multi-room path helpers
- `lib/activeRoom.ts` — replace singleton API with `activateRoom` / `deactivateRoom` / `subscribeActiveRooms`
- `features/tv/hooks/useTVPresence.ts` — add `phase: 'lookup'|'active'` state, call `activateRoom`
- `features/tv/TVClient.tsx` — render `<TVRoomLookup>` when phase is `'lookup'`
- `features/remote/hooks/useRoomGate.ts` — remove singleton subscription, validate via `lookupUserByCode`
- `features/remote/hooks/useRoomGate.test.ts` — update tests for new validation logic
- `features/remote/components/JoinForm.tsx` — remove `activeRoom`/`pointerLoaded` props, add `joinError`/`isJoining`
- `features/remote/RemoteClient.tsx` — update JoinForm prop usage

---

## Task 1: Update lib/roomPaths.ts

Remove the singleton path helper; add the six new multi-room helpers.

**Files:**
- Modify: `lib/roomPaths.ts`

- [ ] **Step 1: Replace the file**

```typescript
// lib/roomPaths.ts
// All Firebase Realtime Database path strings live here.

export const getRoomDataPath = (roomCode: string): string =>
  `rooms/${roomCode}`;

export const getRegisteredUsersPath = (): string => 'registeredUsers';

export const getRegisteredUserPath = (normalizedPhone: string): string =>
  `registeredUsers/${normalizedPhone}`;

export const getRoomCodeIndexPath = (): string => 'roomCodeIndex';

export const getRoomCodeIndexEntryPath = (code: string): string =>
  `roomCodeIndex/${code}`;

export const getActiveRoomsPath = (): string => 'meta/activeRooms';

export const getActiveRoomPresencePath = (code: string): string =>
  `meta/activeRooms/${code}`;
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `getActiveRoomPointerPath` is referenced anywhere the compiler will tell you; fix those references before continuing (they'll be cleaned up properly in Tasks 2 and 5).

- [ ] **Step 3: Commit**

```bash
git add lib/roomPaths.ts
git commit -m "refactor: replace singleton roomPaths with multi-room helpers"
```

---

## Task 2: Replace lib/activeRoom.ts with multi-room presence API

Remove `claimOrGetActiveRoom`, `clearActiveRoomIfMatches`, and `subscribeActiveRoom`. Add `activateRoom`, `deactivateRoom`, and `subscribeActiveRooms`.

**Files:**
- Modify: `lib/activeRoom.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/activeRoom.test.ts`:

```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

const removeMock = vi.fn().mockResolvedValue(undefined);
const cancelMock = vi.fn().mockResolvedValue(undefined);
const onDisconnectMock = vi.fn(() => ({ remove: removeMock, cancel: cancelMock }));
const setMock = vi.fn().mockResolvedValue(undefined);
const removeFnMock = vi.fn().mockResolvedValue(undefined);
const onValueMock = vi.fn(() => () => {});

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  set: setMock,
  remove: removeFnMock,
  onDisconnect: onDisconnectMock,
  onValue: onValueMock,
}));

import { activateRoom, deactivateRoom, subscribeActiveRooms } from './activeRoom';

beforeEach(() => {
  setMock.mockReset().mockResolvedValue(undefined);
  removeFnMock.mockReset().mockResolvedValue(undefined);
  removeMock.mockReset().mockResolvedValue(undefined);
  cancelMock.mockReset().mockResolvedValue(undefined);
  onDisconnectMock.mockReset().mockReturnValue({ remove: removeMock, cancel: cancelMock });
  onValueMock.mockReset().mockReturnValue(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('activateRoom', () => {
  it('sets meta/activeRooms/{code} to true and registers onDisconnect remove', async () => {
    const cleanup = await activateRoom('5678');
    expect(setMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/5678' }, true);
    expect(onDisconnectMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/5678' });
    expect(removeMock).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('cleanup cancels onDisconnect and removes the presence node', async () => {
    const cleanup = await activateRoom('5678');
    await cleanup();
    expect(cancelMock).toHaveBeenCalled();
    expect(removeFnMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/5678' });
  });
});

describe('deactivateRoom', () => {
  it('removes meta/activeRooms/{code}', async () => {
    await deactivateRoom('9012');
    expect(removeFnMock).toHaveBeenCalledWith({ path: 'meta/activeRooms/9012' });
  });
});

describe('subscribeActiveRooms', () => {
  it('calls cb with empty array when snapshot has no data', () => {
    onValueMock.mockImplementation((_ref, cb) => {
      cb({ exists: () => false, val: () => null });
      return () => {};
    });
    const cb = vi.fn();
    subscribeActiveRooms(cb);
    expect(cb).toHaveBeenCalledWith([]);
  });

  it('calls cb with array of keys when snapshot has data', () => {
    onValueMock.mockImplementation((_ref, cb) => {
      cb({ exists: () => true, val: () => ({ '5678': true, '9012': true }) });
      return () => {};
    });
    const cb = vi.fn();
    subscribeActiveRooms(cb);
    expect(cb).toHaveBeenCalledWith(expect.arrayContaining(['5678', '9012']));
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm run test -- lib/activeRoom.test.ts
```

Expected: FAIL — `activateRoom`, `deactivateRoom`, `subscribeActiveRooms` are not exported.

- [ ] **Step 3: Replace lib/activeRoom.ts**

```typescript
import { ref, set, remove, onDisconnect, onValue } from 'firebase/database';
import { db } from './firebase';
import { getActiveRoomPresencePath, getActiveRoomsPath } from './roomPaths';

export async function activateRoom(code: string): Promise<() => Promise<void>> {
  const presenceRef = ref(db, getActiveRoomPresencePath(code));
  await set(presenceRef, true);
  const disconnect = onDisconnect(presenceRef);
  await disconnect.remove();
  return async () => {
    disconnect.cancel().catch(() => {});
    await remove(presenceRef);
  };
}

export async function deactivateRoom(code: string): Promise<void> {
  await remove(ref(db, getActiveRoomPresencePath(code)));
}

export function subscribeActiveRooms(
  cb: (codes: string[]) => void,
): () => void {
  return onValue(ref(db, getActiveRoomsPath()), (snap) => {
    cb(snap.exists() ? Object.keys(snap.val() as Record<string, unknown>) : []);
  });
}
```

- [ ] **Step 4: Run tests — expect green**

```bash
npm run test -- lib/activeRoom.test.ts
```

Expected: PASS (3 describe blocks, 5 tests).

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add lib/activeRoom.ts lib/activeRoom.test.ts
git commit -m "feat: replace singleton activeRoom with multi-room presence API"
```

---

## Task 3: Create lib/registeredUsers.ts

The core library for all registered-user operations: phone normalization, code derivation + collision resolution, and CRUD against `registeredUsers/` + `roomCodeIndex/`.

**Files:**
- Create: `lib/registeredUsers.ts`
- Create: `lib/registeredUsers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/registeredUsers.test.ts`:

```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));

const getMock = vi.fn();
const setMock = vi.fn().mockResolvedValue(undefined);
const updateMock = vi.fn().mockResolvedValue(undefined);
const removeMock = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  get: getMock,
  set: setMock,
  update: updateMock,
  remove: removeMock,
}));

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
  getAllUsers,
} from './registeredUsers';

function makeSnap(exists: boolean, val: unknown = null) {
  return { exists: () => exists, val: () => val };
}

beforeEach(() => {
  getMock.mockReset();
  setMock.mockReset().mockResolvedValue(undefined);
  updateMock.mockReset().mockResolvedValue(undefined);
  removeMock.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

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
  });

  it('throws when phone is already registered', async () => {
    getMock.mockResolvedValueOnce(makeSnap(true)); // phone already exists
    await expect(registerUser({ phone: '0912345678' })).rejects.toThrow('already registered');
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm run test -- lib/registeredUsers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create lib/registeredUsers.ts**

```typescript
import { ref, get, set, update } from 'firebase/database';
import { db } from './firebase';
import {
  getRegisteredUserPath,
  getRegisteredUsersPath,
  getRoomCodeIndexEntryPath,
  getRoomDataPath,
} from './roomPaths';

export interface RegisteredUser {
  normalizedPhone: string;
  roomCode: string;
  displayName?: string;
  suspended: boolean;
  createdAt: number;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return '84' + digits.slice(1);
  return '84' + digits;
}

export function deriveBaseCode(normalizedPhone: string): string {
  return normalizedPhone.slice(-4);
}

export async function resolveUniqueCode(base: string): Promise<string> {
  const taken = await get(ref(db, getRoomCodeIndexEntryPath(base)));
  if (!taken.exists()) return base;
  for (let suffix = 1; ; suffix++) {
    const candidate = `${base}${suffix}`;
    const snap = await get(ref(db, getRoomCodeIndexEntryPath(candidate)));
    if (!snap.exists()) return candidate;
  }
}

export async function registerUser({
  phone,
  displayName,
}: {
  phone: string;
  displayName?: string;
}): Promise<{ roomCode: string; normalizedPhone: string }> {
  const normalizedPhone = normalizePhone(phone);
  const existing = await get(ref(db, getRegisteredUserPath(normalizedPhone)));
  if (existing.exists()) throw new Error('Phone number already registered');

  const base = deriveBaseCode(normalizedPhone);
  const roomCode = await resolveUniqueCode(base);

  const storedUser = {
    roomCode,
    suspended: false,
    createdAt: Date.now(),
    ...(displayName ? { displayName } : {}),
  };

  const updates: Record<string, unknown> = {
    [getRegisteredUserPath(normalizedPhone)]: storedUser,
    [getRoomCodeIndexEntryPath(roomCode)]: normalizedPhone,
    [`${getRoomDataPath(roomCode)}/createdAt`]: storedUser.createdAt,
  };
  await update(ref(db), updates);
  return { roomCode, normalizedPhone };
}

export async function lookupUserByPhone(
  phone: string,
): Promise<RegisteredUser | null> {
  const normalizedPhone = normalizePhone(phone);
  const snap = await get(ref(db, getRegisteredUserPath(normalizedPhone)));
  if (!snap.exists()) return null;
  return { normalizedPhone, ...(snap.val() as Omit<RegisteredUser, 'normalizedPhone'>) };
}

export async function lookupUserByCode(
  code: string,
): Promise<RegisteredUser | null> {
  const indexSnap = await get(ref(db, getRoomCodeIndexEntryPath(code)));
  if (!indexSnap.exists()) return null;
  const normalizedPhone = indexSnap.val() as string;
  const userSnap = await get(ref(db, getRegisteredUserPath(normalizedPhone)));
  if (!userSnap.exists()) return null;
  return { normalizedPhone, ...(userSnap.val() as Omit<RegisteredUser, 'normalizedPhone'>) };
}

export async function isValidRoomCode(code: string): Promise<boolean> {
  const user = await lookupUserByCode(code);
  return user !== null && !user.suspended;
}

export async function suspendUser(phone: string): Promise<void> {
  await set(ref(db, `${getRegisteredUserPath(normalizePhone(phone))}/suspended`), true);
}

export async function unsuspendUser(phone: string): Promise<void> {
  await set(ref(db, `${getRegisteredUserPath(normalizePhone(phone))}/suspended`), false);
}

export async function updateDisplayName(
  phone: string,
  displayName: string,
): Promise<void> {
  await set(
    ref(db, `${getRegisteredUserPath(normalizePhone(phone))}/displayName`),
    displayName,
  );
}

export async function reassignRoomCode(
  phone: string,
  newCode: string,
): Promise<void> {
  const normalizedPhone = normalizePhone(phone);
  const user = await lookupUserByPhone(phone);
  if (!user) throw new Error('User not found');
  const updates: Record<string, unknown> = {
    [`${getRegisteredUserPath(normalizedPhone)}/roomCode`]: newCode,
    [getRoomCodeIndexEntryPath(newCode)]: normalizedPhone,
    [getRoomCodeIndexEntryPath(user.roomCode)]: null,
  };
  await update(ref(db), updates);
}

export async function getAllUsers(): Promise<RegisteredUser[]> {
  const snap = await get(ref(db, getRegisteredUsersPath()));
  if (!snap.exists()) return [];
  return Object.entries(
    snap.val() as Record<string, Omit<RegisteredUser, 'normalizedPhone'>>,
  ).map(([normalizedPhone, data]) => ({ normalizedPhone, ...data }));
}
```

- [ ] **Step 4: Run tests — expect green**

```bash
npm run test -- lib/registeredUsers.test.ts
```

Expected: PASS (all describes pass).

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add lib/registeredUsers.ts lib/registeredUsers.test.ts
git commit -m "feat: add registeredUsers library with phone normalization and room code derivation"
```

---

## Task 4: TV — lookup phase in useTVPresence + TVRoomLookup component

The TV shows a lookup form on mount instead of auto-claiming. After the operator validates a phone or room code, the room activates and normal TV operation begins.

**Files:**
- Modify: `features/tv/hooks/useTVPresence.ts`
- Create: `features/tv/components/TVRoomLookup.tsx`
- Modify: `features/tv/TVClient.tsx`

- [ ] **Step 1: Update features/tv/hooks/useTVPresence.ts**

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { onDisconnect, ref, remove, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { lookupUserByCode, lookupUserByPhone } from '@/lib/registeredUsers';
import { getActiveRoomPresencePath, getRoomDataPath } from '@/lib/roomPaths';
import { getPublicOrigin } from '@/lib/publicOrigin';

const TV_ROOM_STORAGE_KEY = 'karaoke_tv_room';
const CODE_PATTERN = /^\d{4,7}$/;

export type TVPhase = 'lookup' | 'active';

export function useTVPresence() {
  const [phase, setPhase] = useState<TVPhase>('lookup');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  // Re-attach to a previously-activated room stored in localStorage.
  useEffect(() => {
    const fixed = process.env.NEXT_PUBLIC_FIXED_ROOM_ID;
    if (fixed) {
      setRoomCode(fixed);
      setPhase('active');
      return;
    }
    const stored = localStorage.getItem(TV_ROOM_STORAGE_KEY);
    if (stored) {
      setRoomCode(stored);
      setPhase('active');
    }
  }, []);

  // Compute joinUrl once roomCode is known (post-mount to avoid SSR mismatch).
  useEffect(() => {
    if (!roomCode) return;
    const origin = getPublicOrigin() ?? window.location.origin;
    setJoinUrl(`${origin}/?room=${roomCode}`);
  }, [roomCode]);

  // isTvActive + meta/activeRooms presence: write on activate, remove on cleanup/disconnect.
  useEffect(() => {
    if (!roomCode || phase !== 'active') return;

    const isTvRef = ref(db, `${getRoomDataPath(roomCode)}/isTvActive`);
    set(isTvRef, true).catch(() => {});
    const tvDisc = onDisconnect(isTvRef);
    tvDisc.remove().catch(() => {});

    const activeRef = ref(db, getActiveRoomPresencePath(roomCode));
    set(activeRef, true).catch(() => {});
    const activeDisc = onDisconnect(activeRef);
    activeDisc.remove().catch(() => {});

    return () => {
      tvDisc.cancel().catch(() => {});
      remove(isTvRef).catch(() => {});
      activeDisc.cancel().catch(() => {});
      remove(activeRef).catch(() => {});
    };
  }, [roomCode, phase]);

  // Called by TVRoomLookup after successful validation.
  const activateRoomByCode = useCallback(async (code: string) => {
    localStorage.setItem(TV_ROOM_STORAGE_KEY, code);
    setRoomCode(code);
    setPhase('active');
  }, []);

  // Exported for TVRoomLookup to validate the operator's input.
  const resolveRoomCode = useCallback(async (input: string): Promise<string | null> => {
    const trimmed = input.trim();
    // Try as room code first.
    if (CODE_PATTERN.test(trimmed)) {
      const byCode = await lookupUserByCode(trimmed);
      if (byCode && !byCode.suspended) return byCode.roomCode;
    }
    // Try as phone number.
    try {
      const byPhone = await lookupUserByPhone(trimmed);
      if (byPhone && !byPhone.suspended) return byPhone.roomCode;
    } catch {
      // not a valid phone — fall through
    }
    return null;
  }, []);

  return { phase, roomCode, joinUrl, activateRoomByCode, resolveRoomCode };
}
```

- [ ] **Step 2: Create features/tv/components/TVRoomLookup.tsx**

```tsx
'use client';

import { FormEvent, useState } from 'react';

interface TVRoomLookupProps {
  resolveRoomCode: (input: string) => Promise<string | null>;
  onActivate: (code: string) => Promise<void>;
}

export function TVRoomLookup({ resolveRoomCode, onActivate }: TVRoomLookupProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const code = await resolveRoomCode(trimmed);
      if (!code) {
        setError('Không tìm thấy phòng hoặc phòng đang bị tạm ngưng.');
        return;
      }
      await onActivate(code);
    } catch {
      setError('Đã xảy ra lỗi, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center bg-bg text-fg px-6">
      <h1 className="text-gradient-brand text-5xl font-bold mb-2">KARA</h1>
      <p className="text-muted text-sm mb-10">Nhập số điện thoại hoặc mã phòng</p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="VD: 0912345678 hoặc 5678"
          className="w-full px-4 py-3 rounded-2xl border border-border bg-surface text-fg text-center text-lg tracking-widest placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
          autoFocus
          disabled={loading}
        />

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang kiểm tra...' : 'Kích hoạt phòng'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Update features/tv/TVClient.tsx — add lookup phase branch**

Read the current top of `TVClient.tsx` first. Add the import and early return for lookup phase. The `useTVPresence` call already returns `roomCode` and `joinUrl`; now it also returns `phase`, `activateRoomByCode`, and `resolveRoomCode`.

Change the `useTVPresence` destructure from:
```typescript
const { roomCode, joinUrl } = useTVPresence();
```

To:
```typescript
const { phase, roomCode, joinUrl, activateRoomByCode, resolveRoomCode } = useTVPresence();
```

Add the lookup-phase early return immediately after the `useTVPresence` call and before any hooks that depend on `roomCode`:

```tsx
import { TVRoomLookup } from '@/features/tv/components/TVRoomLookup';

// ... inside TVClient, after useTVPresence destructure:
if (phase === 'lookup') {
  return (
    <TVRoomLookup
      resolveRoomCode={resolveRoomCode}
      onActivate={activateRoomByCode}
    />
  );
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors. Fix any import errors before continuing.

- [ ] **Step 5: Smoke-test the TV flow manually**

```bash
npm run dev
```

Open `http://localhost:3000/tv`. You should see the TVRoomLookup form instead of the old TV UI. (Room activation won't work end-to-end until Task 3's `lib/registeredUsers` is connected to real Firebase data, but the form should render.)

- [ ] **Step 6: Commit**

```bash
git add features/tv/hooks/useTVPresence.ts features/tv/components/TVRoomLookup.tsx features/tv/TVClient.tsx
git commit -m "feat: add TV room lookup phase before activation"
```

---

## Task 5: Update useRoomGate — remove singleton, validate via roomCodeIndex

Remove the `subscribeActiveRoom` subscription. Make `submitJoin` validate against `roomCodeIndex` (via `lookupUserByCode`) instead of matching the singleton pointer. Expose `joinError` and `isJoining` state for the join form.

**Files:**
- Modify: `features/remote/hooks/useRoomGate.ts`
- Modify: `features/remote/hooks/useRoomGate.test.ts`

- [ ] **Step 1: Write the updated failing tests**

Replace the entire contents of `features/remote/hooks/useRoomGate.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/registeredUsers', () => ({
  lookupUserByCode: vi.fn(),
}));

import { useRouter, useSearchParams } from 'next/navigation';
import { lookupUserByCode } from '@/lib/registeredUsers';
import { useRoomGate } from './useRoomGate';

const useRouterMock = useRouter as unknown as ReturnType<typeof vi.fn>;
const useSearchParamsMock = useSearchParams as unknown as ReturnType<typeof vi.fn>;
const lookupMock = lookupUserByCode as unknown as ReturnType<typeof vi.fn>;

let pushSpy: ReturnType<typeof vi.fn>;
let assignSpy: ReturnType<typeof vi.fn>;
let originalLocation: Location;

function setUrlRoom(room: string | null) {
  useSearchParamsMock.mockReturnValue({
    get: (key: string) => (key === 'room' ? room : null),
  });
}

async function flushAsync() {
  await new Promise<void>((r) => setTimeout(r, 0));
}

beforeEach(() => {
  pushSpy = vi.fn();
  useRouterMock.mockReturnValue({ push: pushSpy });
  setUrlRoom(null);
  lookupMock.mockReset();

  assignSpy = vi.fn();
  originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: assignSpy },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  vi.clearAllMocks();
});

describe('useRoomGate', () => {
  it('does not attempt any lookup on a fresh load with no room in URL', async () => {
    setUrlRoom(null);
    renderHook(() => useRoomGate());
    await act(async () => { await flushAsync(); });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('submitJoin navigates when code is a valid registered room', async () => {
    lookupMock.mockResolvedValue({ roomCode: '5678', suspended: false });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('5678');
    });
    expect(pushSpy).toHaveBeenCalledWith('/?room=5678');
    expect(result.current.joinError).toBeNull();
  });

  it('submitJoin sets joinError when code is not registered', async () => {
    lookupMock.mockResolvedValue(null);
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('9999');
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('notFound');
  });

  it('submitJoin sets joinError when room is suspended', async () => {
    lookupMock.mockResolvedValue({ roomCode: '5678', suspended: true });
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('5678');
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.joinError).toBe('suspended');
  });

  it('submitJoin ignores inputs that are not 4–7 digits', async () => {
    const { result } = renderHook(() => useRoomGate());
    await act(async () => {
      await result.current.submitJoin('abc');
    });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('handleLeave navigates to / via window.location.assign', async () => {
    setUrlRoom('5678');
    const { result } = renderHook(() => useRoomGate());
    act(() => { result.current.handleLeave(); });
    expect(assignSpy).toHaveBeenCalledWith('/');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm run test -- features/remote/hooks/useRoomGate.test.ts
```

Expected: several FAILs (imports/mocks don't match new API yet).

- [ ] **Step 3: Replace features/remote/hooks/useRoomGate.ts**

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { lookupUserByCode } from '@/lib/registeredUsers';

const ROOM_CODE_PATTERN = /^\d{4,7}$/;

export function useRoomGate() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawRoomCode = searchParams.get('room');
  const roomCode =
    rawRoomCode && ROOM_CODE_PATTERN.test(rawRoomCode) ? rawRoomCode : null;

  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean | null>(null);
  useEffect(() => {
    setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const submitJoin = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!ROOM_CODE_PATTERN.test(trimmed)) return;
      setJoinError(null);
      setIsJoining(true);
      try {
        const user = await lookupUserByCode(trimmed);
        if (!user) { setJoinError('notFound'); return; }
        if (user.suspended) { setJoinError('suspended'); return; }
        router.push(`/?room=${trimmed}`);
      } catch {
        setJoinError('error');
      } finally {
        setIsJoining(false);
      }
    },
    [router],
  );

  const handleLeave = useCallback(() => {
    window.location.assign('/');
  }, []);

  return {
    rawRoomCode,
    roomCode,
    isCoarsePointer,
    joinError,
    isJoining,
    submitJoin,
    handleLeave,
  };
}
```

- [ ] **Step 4: Run tests — expect green**

```bash
npm run test -- features/remote/hooks/useRoomGate.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors (RemoteClient will show type errors because it still passes `activeRoom`/`pointerLoaded` — fix in next task).

- [ ] **Step 6: Commit**

```bash
git add features/remote/hooks/useRoomGate.ts features/remote/hooks/useRoomGate.test.ts
git commit -m "feat: validate room code against registeredUsers instead of singleton pointer"
```

---

## Task 6: Update JoinForm and RemoteClient

Drop the `activeRoom`/`pointerLoaded` props from `JoinForm`; add `joinError`/`isJoining`. Update `RemoteClient` to pass the new props and remove the old ones.

**Files:**
- Modify: `features/remote/components/JoinForm.tsx`
- Modify: `features/remote/RemoteClient.tsx`

- [ ] **Step 1: Replace features/remote/components/JoinForm.tsx**

```tsx
'use client';

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import { OTPInput } from './OTPInput';

interface JoinFormProps {
  onJoin: (code: string) => void;
  joinError: string | null;
  isJoining: boolean;
}

export function JoinForm({ onJoin, joinError, isJoining }: JoinFormProps) {
  const { t } = useTranslation();
  const [inputCode, setInputCode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onJoin(inputCode);
  }

  const errorMessage =
    joinError === 'notFound'
      ? t('home.invalidCode')
      : joinError === 'suspended'
        ? t('home.roomUnavailable', 'Phòng này tạm thời không khả dụng.')
        : joinError === 'error'
          ? t('home.joinError', 'Đã xảy ra lỗi, vui lòng thử lại.')
          : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col items-center gap-6 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-6 sm:p-8 shadow-glow"
    >
      <label className="w-full text-left text-xs uppercase tracking-[0.25em] text-muted">
        {t('home.roomCodeLabel')}
      </label>

      <OTPInput
        value={inputCode}
        onChange={setInputCode}
        onComplete={onJoin}
        ariaLabel={t('home.roomCodeLabel')}
        disabled={isJoining}
      />

      {errorMessage && (
        <p className="text-xs text-danger text-center">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={isJoining || inputCode.length < 4}
        className="w-full py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow transition-transform active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isJoining ? t('home.joining', 'Đang kiểm tra...') : t('home.joinButton')}
      </button>

      <p className="flex items-center gap-2 text-xs text-muted">
        <QrCode size={14} />
        {t('home.qrTip')}
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Update RemoteClient.tsx — fix JoinForm usage**

In `RemoteClient.tsx`, find the `useRoomGate` destructure and update it:

Old:
```typescript
const {
  rawRoomCode,
  roomCode,
  activeRoom,
  pointerLoaded,
  isCoarsePointer,
  submitJoin,
  handleLeave,
} = useRoomGate();
```

New:
```typescript
const {
  rawRoomCode,
  roomCode,
  isCoarsePointer,
  joinError,
  isJoining,
  submitJoin,
  handleLeave,
} = useRoomGate();
```

Find the `<JoinForm ... />` call and update:

Old:
```tsx
<JoinForm
  activeRoom={activeRoom}
  pointerLoaded={pointerLoaded}
  onJoin={submitJoin}
/>
```

New:
```tsx
<JoinForm
  onJoin={submitJoin}
  joinError={joinError}
  isJoining={isJoining}
/>
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Smoke-test the join form**

```bash
npm run dev
```

Open `http://localhost:3000`. The join form should render with no "join active room" shortcut — just the OTP input and the join button. Verify the form renders correctly.

- [ ] **Step 5: Commit**

```bash
git add features/remote/components/JoinForm.tsx features/remote/RemoteClient.tsx
git commit -m "feat: simplify JoinForm to plain code entry, remove singleton activeRoom shortcut"
```

---

## Task 7: Admin auth — layout + login page

Protect all `/admin` routes with Firebase Auth. The authorized admin email is read from `NEXT_PUBLIC_ADMIN_EMAIL`.

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/login/page.tsx`

- [ ] **Step 1: Add NEXT_PUBLIC_ADMIN_EMAIL to your .env.local**

Add this line to `.env.local` (not committed):
```
NEXT_PUBLIC_ADMIN_EMAIL=your-admin@example.com
```

This must match a Firebase Auth account you create in the Firebase console (Authentication → Add user).

- [ ] **Step 2: Create app/admin/layout.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    return onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== adminEmail) {
        router.replace('/admin/login');
      }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted">
        Đang kiểm tra...
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Create app/admin/login/page.tsx**

```tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        await auth.signOut();
        setError('Tài khoản này không có quyền admin.');
        return;
      }
      router.replace('/admin');
    } catch {
      setError('Email hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg text-fg px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 rounded-3xl border border-border bg-surface/70 backdrop-blur-md p-8 shadow-glow"
      >
        <h1 className="text-xl font-bold text-center mb-2">Admin</h1>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="px-4 py-3 rounded-2xl border border-border bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
          required
          className="px-4 py-3 rounded-2xl border border-border bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {error && <p className="text-danger text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="py-3.5 rounded-full bg-gradient-brand text-white font-semibold tracking-wide shadow-glow disabled:opacity-40"
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 5: Verify auth flow manually**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. You should be redirected to `/admin/login`. Sign in with valid admin credentials → redirected to `/admin` (404 until next task). Sign in with wrong credentials → error message.

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx app/admin/login/page.tsx
git commit -m "feat: add admin auth layout and login page with Firebase Auth guard"
```

---

## Task 8: Admin dashboard — user management

The main admin page lets the operator register users, view the user list, and suspend/unsuspend/reassign.

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/_components/RegisterUserForm.tsx`
- Create: `app/admin/_components/UserList.tsx`

- [ ] **Step 1: Create app/admin/_components/RegisterUserForm.tsx**

```tsx
'use client';

import { FormEvent, useState } from 'react';
import { registerUser } from '@/lib/registeredUsers';

interface RegisterUserFormProps {
  onRegistered: () => void;
}

export function RegisterUserForm({ onRegistered }: RegisterUserFormProps) {
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const { roomCode } = await registerUser({
        phone,
        displayName: displayName.trim() || undefined,
      });
      setResult(`Đã tạo phòng: ${roomCode}`);
      setPhone('');
      setDisplayName('');
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-surface">
      <h2 className="font-semibold text-sm uppercase tracking-wider text-muted">Đăng ký người dùng mới</h2>

      <input
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Số điện thoại (VD: 0912345678)"
        required
        className="px-3 py-2 rounded-xl border border-border bg-bg text-fg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Tên hiển thị (tuỳ chọn)"
        className="px-3 py-2 rounded-xl border border-border bg-bg text-fg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />

      {error && <p className="text-danger text-xs">{error}</p>}
      {result && <p className="text-green-400 text-xs">{result}</p>}

      <button
        type="submit"
        disabled={loading || !phone.trim()}
        className="py-2.5 rounded-full bg-gradient-brand text-white text-sm font-semibold disabled:opacity-40"
      >
        {loading ? 'Đang xử lý...' : 'Đăng ký'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create app/admin/_components/UserList.tsx**

```tsx
'use client';

import { useState } from 'react';
import { suspendUser, unsuspendUser, updateDisplayName, type RegisteredUser } from '@/lib/registeredUsers';

interface UserListProps {
  users: RegisteredUser[];
  onRefresh: () => void;
}

export function UserList({ users, onRefresh }: UserListProps) {
  const [loadingPhone, setLoadingPhone] = useState<string | null>(null);

  async function toggleSuspend(user: RegisteredUser) {
    setLoadingPhone(user.normalizedPhone);
    try {
      if (user.suspended) {
        await unsuspendUser(user.normalizedPhone);
      } else {
        await suspendUser(user.normalizedPhone);
      }
      onRefresh();
    } finally {
      setLoadingPhone(null);
    }
  }

  if (users.length === 0) {
    return <p className="text-muted text-sm">Chưa có người dùng nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-muted text-xs uppercase tracking-wider">
            <th className="text-left py-2 pr-4">Số điện thoại</th>
            <th className="text-left py-2 pr-4">Mã phòng</th>
            <th className="text-left py-2 pr-4">Tên</th>
            <th className="text-left py-2 pr-4">Trạng thái</th>
            <th className="text-left py-2">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.normalizedPhone} className="border-t border-border">
              <td className="py-2 pr-4 font-mono">{user.normalizedPhone}</td>
              <td className="py-2 pr-4 font-mono font-bold">{user.roomCode}</td>
              <td className="py-2 pr-4 text-muted">{user.displayName ?? '—'}</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-xs ${user.suspended ? 'bg-danger/20 text-danger' : 'bg-green-500/20 text-green-400'}`}>
                  {user.suspended ? 'Tạm ngưng' : 'Hoạt động'}
                </span>
              </td>
              <td className="py-2">
                <button
                  onClick={() => toggleSuspend(user)}
                  disabled={loadingPhone === user.normalizedPhone}
                  className="text-xs px-3 py-1 rounded-full border border-border hover:bg-surface-2 disabled:opacity-40 transition-colors"
                >
                  {user.suspended ? 'Kích hoạt' : 'Tạm ngưng'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create app/admin/page.tsx**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAllUsers, type RegisteredUser } from '@/lib/registeredUsers';
import { RegisterUserForm } from './_components/RegisterUserForm';
import { UserList } from './_components/UserList';
import { ActiveRoomsList } from './_components/ActiveRoomsList';

export default function AdminPage() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllUsers();
      setUsers(all.sort((a, b) => b.createdAt - a.createdAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  return (
    <main className="min-h-screen bg-bg text-fg px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button
          onClick={() => signOut(auth)}
          className="text-sm text-muted hover:text-fg transition-colors"
        >
          Đăng xuất
        </button>
      </div>

      <div className="grid gap-8">
        <section>
          <RegisterUserForm onRegistered={loadUsers} />
        </section>

        <section>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted mb-3">
            Phòng đang hoạt động
          </h2>
          <ActiveRoomsList users={users} onRefresh={loadUsers} />
        </section>

        <section>
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted mb-3">
            Tất cả người dùng {!loading && `(${users.length})`}
          </h2>
          {loading ? (
            <p className="text-muted text-sm">Đang tải...</p>
          ) : (
            <UserList users={users} onRefresh={loadUsers} />
          )}
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: one error — `ActiveRoomsList` not yet created (fix in Task 9). All other types should be clean.

- [ ] **Step 5: Commit (partial — ActiveRoomsList stubs in next task)**

```bash
git add app/admin/page.tsx app/admin/_components/RegisterUserForm.tsx app/admin/_components/UserList.tsx
git commit -m "feat: admin user management panel with register form and user list"
```

---

## Task 9: Admin active rooms panel

Show live-active rooms and provide a force-end control.

**Files:**
- Create: `app/admin/_components/ActiveRoomsList.tsx`

- [ ] **Step 1: Create app/admin/_components/ActiveRoomsList.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { subscribeActiveRooms, deactivateRoom } from '@/lib/activeRoom';
import { resetRoom as resetRoomFn } from '@/lib/resetRoom';
import { type RegisteredUser } from '@/lib/registeredUsers';

interface ActiveRoomsListProps {
  users: RegisteredUser[];
  onRefresh: () => void;
}

export function ActiveRoomsList({ users, onRefresh }: ActiveRoomsListProps) {
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [ending, setEnding] = useState<string | null>(null);

  useEffect(() => {
    return subscribeActiveRooms(setActiveCodes);
  }, []);

  async function handleForceEnd(code: string) {
    if (!confirm(`Kết thúc phòng ${code}?`)) return;
    setEnding(code);
    try {
      await resetRoomFn(code);
      await deactivateRoom(code);
      onRefresh();
    } finally {
      setEnding(null);
    }
  }

  if (activeCodes.length === 0) {
    return <p className="text-muted text-sm">Không có phòng nào đang hoạt động.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {activeCodes.map((code) => {
        const owner = users.find((u) => u.roomCode === code);
        return (
          <div
            key={code}
            className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border bg-surface"
          >
            <div>
              <span className="font-mono font-bold">{code}</span>
              {owner && (
                <span className="ml-3 text-sm text-muted">
                  {owner.displayName ?? owner.normalizedPhone}
                </span>
              )}
            </div>
            <button
              onClick={() => handleForceEnd(code)}
              disabled={ending === code}
              className="text-xs px-3 py-1 rounded-full border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-40 transition-colors"
            >
              {ending === code ? 'Đang kết thúc...' : 'Kết thúc'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create lib/resetRoom.ts**

`ActiveRoomsList` calls `resetRoom(code)` to wipe the room's Firebase state. It mirrors the exact fields that `hooks/useRoom/settings.ts → resetRoom` clears (verified by reading that file):

```typescript
// lib/resetRoom.ts
import { ref, remove, set } from 'firebase/database';
import { db } from './firebase';
import { getRoomDataPath } from './roomPaths';

export async function resetRoom(code: string): Promise<void> {
  const base = getRoomDataPath(code);
  await Promise.all([
    remove(ref(db, `${base}/queue`)),
    remove(ref(db, `${base}/currentPlaying`)),
    remove(ref(db, `${base}/history`)),
    remove(ref(db, `${base}/playedHistory`)),
    remove(ref(db, `${base}/isPlaying`)),
    set(ref(db, `${base}/lastEndedAt`), Date.now()),
  ]);
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Full test suite**

```bash
npm run test
```

Expected: all tests pass, no skips.

- [ ] **Step 5: Smoke-test admin panel**

```bash
npm run dev
```

1. Open `http://localhost:3000/admin` → redirected to login
2. Sign in with admin credentials → land on dashboard
3. Register a test phone number → room code appears
4. Open `http://localhost:3000/tv` → see TVRoomLookup form → enter the phone number → activates
5. Back in admin dashboard, the active rooms panel should show the room code live

- [ ] **Step 6: Commit**

```bash
git add app/admin/_components/ActiveRoomsList.tsx lib/resetRoom.ts
git commit -m "feat: admin active rooms panel with live list and force-end control"
```

---

## Task 10: Playwright E2E tests

Cover the three key new flows: TV lookup, phone QR/manual join, and wrong code error.

**Files:**
- Create: `e2e/multi-room.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```typescript
// e2e/multi-room.spec.ts
import { test, expect } from '@playwright/test';

// These tests assume a registered room code exists in the Firebase test environment.
// Run against a test Firebase project with a pre-registered room code.
const TEST_ROOM_CODE = process.env.E2E_TEST_ROOM_CODE ?? '5678';

test.describe('TV room lookup', () => {
  test('shows lookup form on /tv instead of immediately activating', async ({ page }) => {
    await page.goto('/tv');
    await expect(page.getByPlaceholder(/điện thoại|mã phòng/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /kích hoạt/i })).toBeVisible();
  });

  test('shows error for unregistered room code', async ({ page }) => {
    await page.goto('/tv');
    await page.getByPlaceholder(/điện thoại|mã phòng/i).fill('0000');
    await page.getByRole('button', { name: /kích hoạt/i }).click();
    await expect(page.getByText(/không tìm thấy|tạm ngưng/i)).toBeVisible();
  });
});

test.describe('Phone join flow', () => {
  test('join form has no active-room shortcut button', async ({ page }) => {
    await page.goto('/');
    // The old singleton shortcut "Tham gia phòng đang mở" should not exist
    await expect(page.getByText(/tham gia phòng đang mở/i)).not.toBeVisible();
    // Plain OTP input should be present
    await expect(page.locator('input[aria-label]').first()).toBeVisible();
  });

  test('manual code entry with unknown code shows error', async ({ page }) => {
    await page.goto('/');
    // Fill all 4 OTP boxes with an unregistered code
    const inputs = page.locator('input[maxlength="1"]');
    await inputs.nth(0).fill('0');
    await inputs.nth(1).fill('0');
    await inputs.nth(2).fill('0');
    await inputs.nth(3).fill('0');
    await page.getByRole('button', { name: /tham gia|join/i }).click();
    await expect(page.getByText(/không tìm thấy|invalid/i)).toBeVisible();
  });

  test('QR scan URL with registered code lands in room', async ({ page }) => {
    await page.goto(`/?room=${TEST_ROOM_CODE}`);
    // Should not show the join form — should render the remote UI
    await expect(page.getByText(/tham gia|join/i)).not.toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
npm run test:e2e -- e2e/multi-room.spec.ts
```

Expected: all tests pass. If the `QR scan` test fails because `E2E_TEST_ROOM_CODE` isn't registered in the test Firebase project, skip it and note it requires a real registered room.

- [ ] **Step 3: Full verification gate**

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Expected output:
```
✅ typecheck
✅ lint
✅ vitest (N tests)
✅ build
```

- [ ] **Step 4: Commit**

```bash
git add e2e/multi-room.spec.ts
git commit -m "test: add E2E specs for TV lookup, phone join, and wrong code error"
```

---

## Post-Implementation Notes

**Firebase RTDB security rules:** `registeredUsers/` and `roomCodeIndex/` should only be writable by the authenticated admin user. Add rules to your Firebase project:

```json
{
  "rules": {
    "registeredUsers": {
      ".read": "auth != null",
      ".write": "auth.token.email === 'your-admin@example.com'"
    },
    "roomCodeIndex": {
      ".read": "auth != null",
      ".write": "auth.token.email === 'your-admin@example.com'"
    },
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": "auth != null"
      }
    },
    "meta": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

**Old data:** The `meta/activeRoom` node in Firebase is now dead. Delete it from the Firebase console after confirming everything works.
