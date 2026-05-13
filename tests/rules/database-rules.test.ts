import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, set, get, push } from 'firebase/database';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RULES_PATH = path.resolve(__dirname, '../../database.rules.json');
const SNAPSHOT_PATH = path.resolve(
  __dirname,
  './fixtures/production-snapshot.json',
);

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-bs-kara',
    database: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      // Host/port pulled from FIREBASE_DATABASE_EMULATOR_HOST when set by
      // `firebase emulators:exec`; explicit fallback matches firebase.json.
      host: '127.0.0.1',
      port: 9000,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearDatabase();
});

const userDb = () => testEnv.unauthenticatedContext().database();

// Strip the dead `volume` field everywhere — Step 0 removes its validate rule
// because no production code path writes it. Real production rooms still have
// it lingering from older builds; reads of those rooms keep working
// (see backward-compat suite below) but new writes that include `volume`
// must reject.
function stripVolume<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(stripVolume) as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'volume') continue;
      out[k] = stripVolume(v);
    }
    return out as T;
  }
  return obj;
}

// Rename room codes in the sanitized snapshot to valid 4-digit numeric codes
// matching the rules' regex. The snapshot uses XX01..XX03 for human
// readability; the rules require ^[0-9]{4}$.
function renameRoomCodes(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const codeMap: Record<string, string> = { XX01: '1001', XX02: '1002', XX03: '1003' };
  const rooms = (snapshot.rooms ?? {}) as Record<string, unknown>;
  const renamed: Record<string, unknown> = {};
  for (const [oldCode, room] of Object.entries(rooms)) {
    const newCode = codeMap[oldCode] ?? oldCode;
    renamed[newCode] = room;
  }
  return {
    meta: { activeRoom: '1001' },
    rooms: renamed,
  };
}

describe('database.rules.json', () => {
  // ─── Smoke test ────────────────────────────────────────────────────────
  // Replays a sanitized production snapshot against the new rules. Every
  // legitimate field/value combination from real rooms must validate.
  describe('production-snapshot smoke test', () => {
    it('all three rooms in the snapshot validate', async () => {
      const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) as Record<
        string,
        unknown
      >;
      const transformed = stripVolume(renameRoomCodes(raw));

      const db = userDb();
      // Write meta first, then each room individually so a per-room failure
      // surfaces with a precise path.
      await assertSucceeds(
        set(ref(db, 'meta/activeRoom'), (transformed.meta as { activeRoom: string }).activeRoom),
      );
      const rooms = transformed.rooms as Record<string, unknown>;
      for (const [code, room] of Object.entries(rooms)) {
        await assertSucceeds(set(ref(db, `rooms/${code}`), room));
      }

      // Sanity-check the writes round-tripped.
      const snap = await get(ref(db, 'rooms/1001/currentPlaying/id'));
      expect(snap.val()).toBe('WfLSgRDL-D4');
    });
  });

  // ─── Backward compatibility for legacy `volume` ────────────────────────
  // Real production rooms still have `volume: 100` from older builds. Reads
  // must keep working; new writes must reject.
  describe('legacy volume field', () => {
    it('reads of a legacy room with volume succeed', async () => {
      // Plant data with rules disabled — simulates a room created under the
      // old rules that still has `volume` lingering.
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const adminDb = ctx.database();
        await set(ref(adminDb, 'rooms/1234'), {
          currentPlaying: {
            id: 'abc',
            title: 't',
            channel: 'c',
            thumbnail: 'th',
            duration: '',
          },
          volume: 100,
        });
      });

      const db = userDb();
      const snap = await assertSucceeds(get(ref(db, 'rooms/1234/volume')));
      expect(snap.val()).toBe(100);
    });

    it('new write of volume on a fresh room is rejected', async () => {
      const db = userDb();
      // First seed a valid currentPlaying so the room exists with required
      // shape, then attempt to add `volume` — falls under $other and rejects.
      await assertSucceeds(
        set(ref(db, 'rooms/1234/currentPlaying'), {
          id: 'abc',
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
        }),
      );
      await assertFails(set(ref(db, 'rooms/1234/volume'), 100));
    });
  });

  // ─── Length-cap rejections ─────────────────────────────────────────────
  describe('length caps', () => {
    const validSong = (overrides: Record<string, unknown> = {}) => ({
      id: 'abc',
      title: 't',
      channel: 'c',
      thumbnail: 'th',
      duration: '',
      ...overrides,
    });

    it('rejects title > 500 chars', async () => {
      const db = userDb();
      await assertFails(
        set(
          ref(db, 'rooms/1234/currentPlaying'),
          validSong({ title: 'x'.repeat(501) }),
        ),
      );
    });

    it('accepts title at 500 chars', async () => {
      const db = userDb();
      await assertSucceeds(
        set(
          ref(db, 'rooms/1234/currentPlaying'),
          validSong({ title: 'x'.repeat(500) }),
        ),
      );
    });

    it('rejects mcText > 500 chars', async () => {
      const db = userDb();
      await assertFails(
        set(
          ref(db, 'rooms/1234/currentPlaying'),
          validSong({ mcText: 'x'.repeat(501) }),
        ),
      );
    });

    it('rejects requesterName > 60 chars', async () => {
      const db = userDb();
      await assertFails(
        set(
          ref(db, 'rooms/1234/currentPlaying'),
          validSong({ requesterName: 'x'.repeat(61) }),
        ),
      );
    });

    it('accepts requesterName at 60 chars', async () => {
      const db = userDb();
      await assertSucceeds(
        set(
          ref(db, 'rooms/1234/currentPlaying'),
          validSong({ requesterName: 'x'.repeat(60) }),
        ),
      );
    });
  });

  // ─── Schema injection rejections ───────────────────────────────────────
  describe('schema injection', () => {
    it('rejects unknown root field outside meta/rooms', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'attackerData/x'), 'value'));
    });

    it('rejects unknown field at room level (e.g. rooms/1234/junk)', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'rooms/1234/junk'), 'value'));
    });

    it('rejects unknown field inside a queue item', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/1234/queue/abc'), {
          id: 'a',
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
          extraField: 'oops',
        }),
      );
    });

    it('rejects unknown sibling under meta', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'meta/somethingElse'), 'x'));
    });
  });

  // ─── Room code format ─────────────────────────────────────────────────
  describe('room code format', () => {
    it('rejects 5-digit room code', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/12345/currentPlaying'), {
          id: 'a',
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
        }),
      );
    });

    it('rejects alphabetic room code', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/abcd/currentPlaying'), {
          id: 'a',
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
        }),
      );
    });

    it('accepts 4-digit numeric room code', async () => {
      const db = userDb();
      await assertSucceeds(
        set(ref(db, 'rooms/1234/currentPlaying'), {
          id: 'a',
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
        }),
      );
    });

    it('rejects room code with mixed digits and letters', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/12a4/currentPlaying'), {
          id: 'a',
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
        }),
      );
    });
  });

  // ─── Enum field validation ────────────────────────────────────────────
  describe('randomFilters enum fields', () => {
    it('rejects invalid type value', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'rooms/1234/randomFilters/type'), 'invalid'));
    });

    it('accepts type = all', async () => {
      const db = userDb();
      await assertSucceeds(set(ref(db, 'rooms/1234/randomFilters/type'), 'all'));
    });

    it('accepts type = solo, duet', async () => {
      const db = userDb();
      await assertSucceeds(set(ref(db, 'rooms/1234/randomFilters/type'), 'solo'));
      await assertSucceeds(set(ref(db, 'rooms/1234/randomFilters/type'), 'duet'));
    });

    it('rejects invalid genre value', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/1234/randomFilters/genre'), 'metalcore'),
      );
    });

    it('accepts allowed genre values', async () => {
      const db = userDb();
      for (const g of ['all', 'bolero', 'caco', 'tre']) {
        await assertSucceeds(set(ref(db, 'rooms/1234/randomFilters/genre'), g));
      }
    });

    it('rejects invalid tone value', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'rooms/1234/randomFilters/tone'), 'robot'));
    });
  });

  // ─── Type coercion guards ─────────────────────────────────────────────
  describe('type validation', () => {
    it('rejects non-boolean isPlaying', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'rooms/1234/isPlaying'), 'yes'));
    });

    it('rejects non-numeric lastEndedAt', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/1234/lastEndedAt'), '2024-01-01'),
      );
    });

    it('rejects activeRoom that is not 4-digit', async () => {
      const db = userDb();
      await assertFails(set(ref(db, 'meta/activeRoom'), 'abcd'));
      await assertFails(set(ref(db, 'meta/activeRoom'), '12345'));
    });

    it('accepts activeRoom = null (clear) and a valid 4-digit code', async () => {
      const db = userDb();
      await assertSucceeds(set(ref(db, 'meta/activeRoom'), '1234'));
      await assertSucceeds(set(ref(db, 'meta/activeRoom'), null));
    });
  });

  // ─── Required fields on song payloads ─────────────────────────────────
  describe('required fields', () => {
    it('rejects currentPlaying missing required `id`', async () => {
      const db = userDb();
      await assertFails(
        set(ref(db, 'rooms/1234/currentPlaying'), {
          title: 't',
          channel: 'c',
          thumbnail: 'th',
          duration: '',
        }),
      );
    });

    it('rejects emoji entry missing `timestamp`', async () => {
      const db = userDb();
      // `push` returns a ThenableReference, not a Promise; .then() converts it
      // for assertFails.
      await assertFails(
        push(ref(db, 'rooms/1234/emojis'), { emoji: '🔥' }).then(() => undefined),
      );
    });

    it('accepts a fully-formed emoji entry', async () => {
      const db = userDb();
      await assertSucceeds(
        push(ref(db, 'rooms/1234/emojis'), {
          emoji: '🔥',
          timestamp: Date.now(),
        }).then(() => undefined),
      );
    });
  });

  // ─── Admin subscription rules (Commit 2 additions) ─────────────────────
  describe('subscriptions / admin gate', () => {
    const ADMIN_EMAIL = 'admin@example.com';
    // RTDB keys can't contain `.`. The rules and the encodeEmailKey helper
    // both map `.` → `,` to make the email a valid key segment.
    const ADMIN_EMAIL_KEY = ADMIN_EMAIL.replace(/\./g, ',');

    const validSubscription = (overrides: Record<string, unknown> = {}) => ({
      userPhone: '+84901234567',
      userId: null,
      type: 'trial',
      status: 'active',
      durationDays: 14,
      startDate: 0,
      endDate: 14 * 86_400_000,
      source: 'manual_admin',
      paymentRef: null,
      createdBy: null,
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    });

    async function seedAdmin() {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await set(ref(ctx.database(), `admins/emails/${ADMIN_EMAIL_KEY}`), {
          uid: 'admin-uid',
          addedAt: Date.now(),
        });
      });
    }

    function adminDb() {
      return testEnv
        .authenticatedContext('admin-uid', { email: ADMIN_EMAIL })
        .database();
    }

    function strangerDb() {
      return testEnv
        .authenticatedContext('other-uid', { email: 'nobody@example.com' })
        .database();
    }

    it('admin can read subscriptions', async () => {
      await seedAdmin();
      await assertSucceeds(get(ref(adminDb(), 'subscriptions')));
    });

    it('non-admin (authenticated but not in admins/emails) cannot read subscriptions', async () => {
      await seedAdmin();
      await assertFails(get(ref(strangerDb(), 'subscriptions')));
    });

    it('unauthenticated cannot read subscriptions', async () => {
      await seedAdmin();
      await assertFails(get(ref(userDb(), 'subscriptions')));
    });

    it('admin can write a valid subscription record', async () => {
      await seedAdmin();
      await assertSucceeds(
        set(ref(adminDb(), 'subscriptions/abc'), validSubscription()),
      );
    });

    it('rejects subscription with wrong-type durationDays', async () => {
      await seedAdmin();
      await assertFails(
        set(
          ref(adminDb(), 'subscriptions/abc'),
          validSubscription({ durationDays: 'thirty' }),
        ),
      );
    });

    it('rejects subscription missing required field', async () => {
      await seedAdmin();
      const missing = validSubscription();
      delete (missing as Record<string, unknown>).startDate;
      await assertFails(set(ref(adminDb(), 'subscriptions/abc'), missing));
    });

    it('rejects subscription with unknown extra field (via $other)', async () => {
      await seedAdmin();
      await assertFails(
        set(
          ref(adminDb(), 'subscriptions/abc'),
          validSubscription({ bogus: 'oops' }),
        ),
      );
    });

    it('rejects subscription with status = expired (only active|cancelled allowed)', async () => {
      await seedAdmin();
      await assertFails(
        set(
          ref(adminDb(), 'subscriptions/abc'),
          validSubscription({ status: 'expired' }),
        ),
      );
    });

    it('rejects subscription with non-VN userPhone', async () => {
      await seedAdmin();
      await assertFails(
        set(
          ref(adminDb(), 'subscriptions/abc'),
          validSubscription({ userPhone: '0901234567' }),
        ),
      );
      await assertFails(
        set(
          ref(adminDb(), 'subscriptions/abc'),
          validSubscription({ userPhone: '+1234567890' }),
        ),
      );
    });

    it('subscriptionTrialClaimed: admin can set to true (claim)', async () => {
      await seedAdmin();
      await assertSucceeds(
        set(ref(adminDb(), 'subscriptionTrialClaimed/+84901234567'), true),
      );
    });

    it('subscriptionTrialClaimed: cannot be deleted (lifetime rule)', async () => {
      await seedAdmin();
      // Plant the flag with rules disabled.
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await set(
          ref(ctx.database(), 'subscriptionTrialClaimed/+84901234567'),
          true,
        );
      });
      await assertFails(
        set(ref(adminDb(), 'subscriptionTrialClaimed/+84901234567'), null),
      );
    });

    it('subscriptionTrialClaimed: cannot be set to false', async () => {
      await seedAdmin();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await set(
          ref(ctx.database(), 'subscriptionTrialClaimed/+84901234567'),
          true,
        );
      });
      await assertFails(
        set(ref(adminDb(), 'subscriptionTrialClaimed/+84901234567'), false),
      );
    });

    it('subscriptionTrialClaimed: rejects non-VN-format phone key', async () => {
      await seedAdmin();
      await assertFails(
        set(ref(adminDb(), 'subscriptionTrialClaimed/0901234567'), true),
      );
    });

    it('subscriptionsByPhone: admin can pointer-write', async () => {
      await seedAdmin();
      await assertSucceeds(
        set(
          ref(adminDb(), 'subscriptionsByPhone/+84901234567/abc'),
          true,
        ),
      );
    });

    it('subscriptionsByPhone: rejects non-VN-format phone key', async () => {
      await seedAdmin();
      await assertFails(
        set(ref(adminDb(), 'subscriptionsByPhone/0901234567/abc'), true),
      );
    });

    it('subscriptionsByPhone: rejects non-true value', async () => {
      await seedAdmin();
      await assertFails(
        set(
          ref(adminDb(), 'subscriptionsByPhone/+84901234567/abc'),
          false,
        ),
      );
      await assertFails(
        set(
          ref(adminDb(), 'subscriptionsByPhone/+84901234567/abc'),
          'yes',
        ),
      );
    });

    it('admins/emails: requires admin auth to write', async () => {
      await seedAdmin();
      const newEmailKey = 'newadmin@example,com';
      // Stranger cannot add themselves to the admin list.
      await assertFails(
        set(ref(strangerDb(), `admins/emails/${newEmailKey}`), {
          uid: 'new-uid',
          addedAt: Date.now(),
        }),
      );
      // Existing admin can.
      await assertSucceeds(
        set(ref(adminDb(), `admins/emails/${newEmailKey}`), {
          uid: 'new-uid',
          addedAt: Date.now(),
        }),
      );
    });

    it('admins/emails: rejects record missing required fields', async () => {
      await seedAdmin();
      const k = 'another@example,com';
      await assertFails(
        set(ref(adminDb(), `admins/emails/${k}`), { uid: 'x' }),
      );
      await assertFails(
        set(ref(adminDb(), `admins/emails/${k}`), { addedAt: 1 }),
      );
    });
  });
});
