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
  if (digits.length < 9) throw new Error(`Invalid phone number: "${raw}"`);
  if (digits.startsWith('0084')) return digits.slice(2);
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return '84' + digits.slice(1);
  return '84' + digits;
}

export function deriveBaseCode(normalizedPhone: string): string {
  return normalizedPhone.slice(-4);
}

const MAX_SUFFIX = 999;

export async function resolveUniqueCode(base: string): Promise<string> {
  const taken = await get(ref(db, getRoomCodeIndexEntryPath(base)));
  if (!taken.exists()) return base;
  for (let suffix = 1; suffix <= MAX_SUFFIX; suffix++) {
    const candidate = `${base}${suffix}`;
    const snap = await get(ref(db, getRoomCodeIndexEntryPath(candidate)));
    if (!snap.exists()) return candidate;
  }
  throw new Error(`Could not find a unique room code for base "${base}" after ${MAX_SUFFIX} attempts`);
}

export async function registerUser({
  phone,
  displayName,
  uid,
}: {
  phone: string;
  displayName?: string;
  uid?: string;
}): Promise<{ roomCode: string; normalizedPhone: string }> {
  const normalizedPhone = normalizePhone(phone);
  // Note: non-transactional check; concurrent duplicate registrations are prevented by Firebase Security Rules.
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
    ...(uid ? { [`${getRoomDataPath(roomCode)}/hostUid`]: uid } : {}),
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
  const [user, newCodeSnap] = await Promise.all([
    lookupUserByPhone(phone),
    get(ref(db, getRoomCodeIndexEntryPath(newCode))),
  ]);
  if (!user) throw new Error('User not found');
  if (newCodeSnap.exists() && newCodeSnap.val() !== normalizedPhone) {
    throw new Error(`Room code ${newCode} is already taken`);
  }
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
