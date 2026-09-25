import { ref, get, set, update } from 'firebase/database';
import {
  db,
  getRegisteredUserPath,
  getRoomCodeIndexEntryPath,
  getRoomDataPath,
} from '@bs-kara/shared';

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

function deriveBaseCode(normalizedPhone: string): string {
  return normalizedPhone.slice(-4);
}

async function resolveUniqueCode(base: string): Promise<string> {
  const taken = await get(ref(db, getRoomCodeIndexEntryPath(base)));
  if (!taken.exists()) return base;
  for (let suffix = 1; suffix <= 999; suffix++) {
    const candidate = `${base}${suffix}`;
    const snap = await get(ref(db, getRoomCodeIndexEntryPath(candidate)));
    if (!snap.exists()) return candidate;
  }
  throw new Error(`Could not find a unique room code for base "${base}"`);
}

export async function registerUser({
  phone,
  displayName,
  uid,
}: {
  phone: string;
  displayName?: string;
  uid?: string;
}): Promise<{ roomCode: string }> {
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
    ...(uid ? { [`${getRoomDataPath(roomCode)}/hostUid`]: uid } : {}),
  };
  await update(ref(db), updates);
  return { roomCode };
}

export async function lookupUserByPhone(phone: string): Promise<RegisteredUser | null> {
  const normalizedPhone = normalizePhone(phone);
  const snap = await get(ref(db, getRegisteredUserPath(normalizedPhone)));
  if (!snap.exists()) return null;
  return { normalizedPhone, ...(snap.val() as Omit<RegisteredUser, 'normalizedPhone'>) };
}

export async function ensureHostUid(roomCode: string, uid: string): Promise<void> {
  await set(ref(db, `${getRoomDataPath(roomCode)}/hostUid`), uid);
}
